import { spawn, execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import net from 'node:net';
import dgram from 'node:dgram';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { encodeInvite } from './invite.js';
import { encodePeerHostname, isValidIpv4, toMember } from './peers.js';

export const DEFAULT_PEER = 'tcp://public.easytier.cn:11010';

export function buildCoreArguments({ invite, playerName, role, rpcPort, listenerPort, peer = DEFAULT_PEER, platform = process.platform, noTun = false }) {
  const args = [
    '--instance-name', 'playtogether',
    '--hostname', encodePeerHostname(role, playerName),
    '--rpc-portal', `127.0.0.1:${rpcPort}`,
    '--rpc-portal-whitelist', '127.0.0.1/32,::1/128',
    '--peers', peer,
    '--encryption-algorithm', 'aes-gcm',
    '--latency-first',
    '--console-log-level', 'info',
  ];

  if (noTun) {
    args.push('--no-tun');
  } else {
    args.push('--dhcp');
  }

  if (listenerPort) {
    args.push('--listeners', `tcp://0.0.0.0:${listenerPort}`, `udp://0.0.0.0:${listenerPort}`);
  }

  if (platform === 'win32' && !noTun) {
    args.push('--enable-udp-broadcast-relay');
  }

  return args;
}

export class EasyTierService extends EventEmitter {
  constructor({ platform = process.platform, coreDirectory, peer = DEFAULT_PEER, spawnImpl = spawn, execFileImpl = execFile, noTun = false, listenerPort = null } = {}) {
    super();
    this.platform = platform;
    this.coreDirectory = coreDirectory;
    this.peer = peer;
    this.spawnImpl = spawnImpl;
    this.execFileImpl = execFileImpl;
    this.noTun = noTun;
    this.listenerPort = listenerPort;
    this.child = null;
    this.invite = null;
    this.role = null;
    this.playerName = null;
    this.rpcPort = null;
    this.pollTimer = null;
    this.stopping = false;
    this.starting = false;
    this.logs = [];
    this.status = this.idleStatus();
  }

  idleStatus() {
    return {
      state: 'idle',
      isHost: false,
      playerName: '',
      inviteCode: '',
      virtualIp: '',
      members: [],
      lastError: '',
    };
  }

  getStatus() {
    return {
      ...this.status,
      members: [...this.status.members],
    };
  }

  getCoreInfo() {
    return {
      platform: this.platform,
      supported: this.platform === 'win32',
      peer: this.peer,
      coreDirectory: this.coreDirectory || '',
      running: Boolean(this.child),
    };
  }

  async start(invite, role, playerName) {
    if (this.child || this.starting) {
      throw new Error('已经在房间中，请先离开当前房间');
    }
    if (this.platform !== 'win32' && !this.noTun) {
      throw new Error('当前首版仅支持 Windows 虚拟网卡组网');
    }
    if (!this.coreDirectory) {
      throw new Error('尚未配置 EasyTier 核心目录');
    }

    this.starting = true;
    this.invite = invite;
    this.role = role;
    this.playerName = playerName;
    this.stopping = false;
    this.status = {
      ...this.idleStatus(),
      state: 'starting',
      isHost: role === 'host',
      playerName,
      inviteCode: encodeInvite(invite),
    };
    this.emitStatus();

    try {
      const corePath = path.join(this.coreDirectory, this.platform === 'win32' ? 'easytier-core.exe' : 'easytier-core');
      await access(corePath);
      this.rpcPort = await findAvailableTcpPort();
      const listenerPort = this.listenerPort ?? await findAvailableListenerPort();
      const args = buildCoreArguments({
        invite,
        playerName,
        role,
        rpcPort: this.rpcPort,
        listenerPort,
        peer: this.peer,
        platform: this.platform,
        noTun: this.noTun,
      });
      const child = this.spawnImpl(corePath, args, {
        cwd: this.coreDirectory,
        env: {
          ...process.env,
          ET_NETWORK_NAME: invite.networkName,
          ET_NETWORK_SECRET: invite.networkSecret,
        },
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      this.child = child;
      child.stdout.on('data', (chunk) => this.appendLog(chunk));
      child.stderr.on('data', (chunk) => this.appendLog(chunk));
      child.once('error', (error) => this.handleChildError(child, error));
      child.once('exit', (code, signal) => this.handleChildExit(child, code, signal));

      await this.waitUntilReady(child);
      this.pollTimer = setInterval(() => void this.refresh(), 2500);
      return this.getStatus();
    } catch (error) {
      await this.stop();
      this.status = {
        ...this.idleStatus(),
        state: 'error',
        lastError: friendlyCoreError(error),
      };
      this.emitStatus();
      throw new Error(this.status.lastError);
    } finally {
      this.starting = false;
    }
  }

  async waitUntilReady(child) {
    const deadline = Date.now() + 25000;
    let lastError;
    while (Date.now() < deadline) {
      if (this.child !== child || child.exitCode !== null || child.signalCode !== null) {
        throw new Error('组网核心提前退出，请检查管理员权限和虚拟网卡组件');
      }
      try {
        await this.refresh();
        if (this.noTun || isValidIpv4(this.status.virtualIp)) {
          this.status.state = 'connected';
          this.emitStatus();
          return;
        }
      } catch (error) {
        lastError = error;
      }
      await delay(700);
    }
    throw new Error(lastError ? `组网核心未就绪：${lastError.message}` : '组网核心启动超时，请检查网络和管理员权限');
  }

  async refresh() {
    if (!this.child || !this.rpcPort) {
      return;
    }

    const cliPath = path.join(this.coreDirectory, this.platform === 'win32' ? 'easytier-cli.exe' : 'easytier-cli');
    const baseArgs = ['--rpc-portal', `127.0.0.1:${this.rpcPort}`, '--output', 'json'];
    const [nodeOutput, peerOutput] = await Promise.all([
      this.execFileAsync(cliPath, [...baseArgs, 'node', 'info']),
      this.execFileAsync(cliPath, [...baseArgs, 'peer', 'list']),
    ]);
    if (!this.child) {
      return;
    }

    const node = parseJson(nodeOutput);
    const peers = parseJson(peerOutput);
    if (!Array.isArray(peers)) {
      throw new Error('核心返回了无法识别的成员列表');
    }

    const virtualIp = isValidIpv4(node.ipv4_addr) ? node.ipv4_addr : '';
    const members = peers
      .filter((peer) => peer.cost === 'Local' || isValidIpv4(peer.ipv4))
      .map((peer) => toMember(peer, node.peer_id))
      .sort((a, b) => Number(b.isSelf) - Number(a.isSelf) || Number(a.role === 'guest') - Number(b.role === 'guest'));

    this.status = {
      ...this.status,
      state: this.noTun || virtualIp ? 'connected' : 'starting',
      virtualIp,
      members,
      lastError: '',
    };
    this.emitStatus();
  }

  execFileAsync(executable, args) {
    return new Promise((resolve, reject) => {
      this.execFileImpl(executable, args, {
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      }, (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr?.toString().trim() || error.message));
        } else {
          resolve(stdout.toString());
        }
      });
    });
  }

  handleChildError(child, error) {
    if (this.child !== child) {
      return;
    }
    this.status = { ...this.status, state: 'error', lastError: friendlyCoreError(error) };
    this.emitStatus();
  }

  handleChildExit(child, code, signal) {
    if (this.child !== child) {
      return;
    }
    this.child = null;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    if (!this.stopping && !this.starting) {
      this.status = {
        ...this.status,
        state: 'error',
        lastError: `组网核心已退出（${signal || `代码 ${code}`}），请离开房间后重试`,
      };
      this.emitStatus();
    }
  }

  appendLog(chunk) {
    const secrets = this.invite ? [this.invite.networkName, this.invite.networkSecret] : [];
    let text = chunk.toString();
    for (const secret of secrets) {
      text = text.replaceAll(secret, '[已隐藏]');
    }
    this.logs.push(...text.split(/\r?\n/).filter(Boolean));
    this.logs = this.logs.slice(-200);
  }

  async stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.stopping = true;
    const child = this.child;
    if (child) {
      await terminateChild(child, this.platform);
      if (this.child === child) {
        this.child = null;
      }
    }
    this.invite = null;
    this.role = null;
    this.playerName = null;
    this.rpcPort = null;
    this.status = this.idleStatus();
    this.stopping = false;
    this.emitStatus();
  }

  emitStatus() {
    this.emit('status', this.getStatus());
  }
}

function parseJson(output) {
  try {
    return JSON.parse(output);
  } catch {
    throw new Error('无法解析组网核心状态');
  }
}

function friendlyCoreError(error) {
  const message = error?.message || String(error);
  if (/ENOENT/.test(message)) {
    return '缺少 EasyTier 核心文件，请先运行 npm run fetch:core 或重新安装应用';
  }
  if (/EACCES|拒绝访问|access denied|permission/i.test(message)) {
    return '没有足够权限创建虚拟网卡，请以管理员身份运行 PlayTogether';
  }
  return message.slice(0, 500);
}

async function terminateChild(child, platform) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once('exit', resolve));
  if (platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true }, () => {});
  } else {
    child.kill('SIGTERM');
  }
  await Promise.race([exited, delay(4000)]);
}

export async function findAvailableTcpPort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

export async function findAvailableListenerPort() {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const port = 20000 + Math.floor(Math.random() * 30000);
    if (await canBindTcp(port) && await canBindUdp(port)) {
      return port;
    }
  }
  throw new Error('找不到可用的本地组网端口');
}

function canBindTcp(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => resolve(false));
    server.listen(port, '0.0.0.0', () => server.close(() => resolve(true)));
  });
}

function canBindUdp(port) {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    socket.unref();
    socket.once('error', () => {
      socket.close();
      resolve(false);
    });
    socket.bind(port, '0.0.0.0', () => socket.close(() => resolve(true)));
  });
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
