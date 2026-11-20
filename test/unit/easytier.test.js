import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCoreArguments, EasyTierService, findAvailableListenerPort, findAvailableTcpPort } from '../../electron/main/easytier.js';
import { createInvite } from '../../electron/main/invite.js';

test('核心参数启用加密、DHCP、广播和中继，但不泄露密钥', () => {
  const invite = createInvite();
  const args = buildCoreArguments({ invite, playerName: 'Castle', role: 'host', rpcPort: 15888, listenerPort: 21010, platform: 'win32' });
  assert.ok(args.includes('--dhcp'));
  assert.ok(args.includes('--enable-udp-broadcast-relay'));
  assert.ok(args.includes('--encryption-algorithm'));
  assert.ok(args.includes('aes-gcm'));
  assert.ok(args.includes('tcp://0.0.0.0:21010'));
  assert.equal(args.includes(invite.networkSecret), false);
  assert.equal(args.includes(invite.networkName), false);
  assert.equal(args.includes('--enable-exit-node'), false);
  assert.equal(args.includes('--accept-dns'), false);
});

test('端口分配器返回可用端口', async () => {
  const rpcPort = await findAvailableTcpPort();
  const listenerPort = await findAvailableListenerPort();
  assert.ok(rpcPort > 0 && rpcPort <= 65535);
  assert.ok(listenerPort >= 20000 && listenerPort < 50000);
});

test('服务启动真实子进程接口、读取状态并清理子进程', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'playtogether-core-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, 'easytier-core'), 'fake');
  await writeFile(path.join(root, 'easytier-cli'), 'fake');

  const child = fakeChild();
  let spawnOptions;
  let spawnArgs;
  const service = new EasyTierService({
    platform: 'darwin',
    coreDirectory: root,
    noTun: true,
    spawnImpl: (_executable, args, options) => {
      spawnArgs = args;
      spawnOptions = options;
      return child;
    },
    execFileImpl: (_executable, args, _options, callback) => {
      const isNode = args.includes('node');
      const output = isNode
        ? { peer_id: 1, ipv4_addr: '' }
        : [{ id: '1', hostname: 'PT_H_Castle', ipv4: '', cost: 'Local', lat_ms: '-', loss_rate: '-' }];
      process.nextTick(() => callback(null, JSON.stringify(output), ''));
    },
  });

  const invite = createInvite();
  const status = await service.start(invite, 'host', 'Castle');
  assert.equal(status.state, 'connected');
  assert.equal(status.members[0].name, 'Castle');
  assert.equal(spawnOptions.env.ET_NETWORK_SECRET, invite.networkSecret);
  assert.equal(spawnOptions.env.ET_NETWORK_NAME, invite.networkName);
  assert.equal(spawnArgs.includes(invite.networkSecret), false);
  assert.equal(service.getCoreInfo().running, true);

  await service.stop();
  assert.equal(service.getStatus().state, 'idle');
  assert.equal(service.getCoreInfo().running, false);
  assert.equal(child.killed, true);
});

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.pid = 12345;
  child.exitCode = null;
  child.signalCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 0;
    process.nextTick(() => child.emit('exit', 0, null));
    return true;
  };
  return child;
}
