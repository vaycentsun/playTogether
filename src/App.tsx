import { useEffect, useMemo, useState } from 'react';

const emptyStatus: RoomStatus = {
  state: 'idle',
  isHost: false,
  playerName: '',
  inviteCode: '',
  virtualIp: '',
  members: [],
  lastError: '',
};

function App() {
  const [status, setStatus] = useState<RoomStatus>(emptyStatus);
  const [coreInfo, setCoreInfo] = useState<CoreInfo | null>(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [inviteCode, setInviteCode] = useState('');
  const [gamePath, setGamePath] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const unsubscribe = window.playTogether.onRoomStatus(setStatus);
    void window.playTogether.getRoomStatus().then(setStatus);
    void window.playTogether.getCoreInfo().then(setCoreInfo);
    void window.playTogether.getGamePath().then(async (savedPath) => {
      setGamePath(savedPath || await window.playTogether.detectGame());
    });
    return unsubscribe;
  }, []);

  const inRoom = status.state === 'connected' || status.state === 'starting' || Boolean(status.inviteCode && status.state === 'error');
  const hostMember = useMemo(() => status.members.find((member) => member.role === 'host'), [status.members]);
  const hostIp = status.isHost ? status.virtualIp : hostMember?.ip || '';
  const onlineMembers = status.members.filter((member) => !member.isSelf).length;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message.replace(/^Error invoking remote method '[^']+': Error: /, '') : '操作失败，请重试');
    } finally {
      setBusy(false);
    }
  }

  async function createRoom() {
    localStorage.setItem('playerName', playerName);
    await run(async () => setStatus(await window.playTogether.createRoom(playerName)));
  }

  async function joinRoom() {
    localStorage.setItem('playerName', playerName);
    await run(async () => setStatus(await window.playTogether.joinRoom(inviteCode, playerName)));
  }

  async function selectGame() {
    await run(async () => {
      const selected = await window.playTogether.selectGame();
      if (selected) setGamePath(selected);
    });
  }

  async function copy(value: string, label: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(''), 1600);
  }

  const stateText = status.state === 'connected'
    ? onlineMembers > 0 ? `${onlineMembers + 1} 人在线` : '等待朋友加入'
    : status.state === 'starting' ? '正在组网' : status.state === 'error' ? '连接异常' : '未连接';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark"><NetworkIcon /></span>
          <span>PlayTogether</span>
          <span className="version">ALPHA</span>
        </div>
        <div className={`connection-pill ${status.state}`}>
          <span className="status-dot" />{stateText}
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="eyebrow">HEROES III · HD MOD</div>
          <h1>异地朋友，也能坐在同一局域网。</h1>
          <p>加密组网，自动分配虚拟 IP。不需要端口映射，也不需要复杂的对战平台。</p>
        </section>

        {!coreInfo?.supported && (
          <div className="notice warning">
            当前首版的虚拟网卡组网仅支持 Windows。界面可以预览，但创建和加入房间需要在 Windows 上运行。
          </div>
        )}
        {(error || status.lastError) && <div className="notice error">{error || status.lastError}</div>}

        {!inRoom ? (
          <div className="entry-grid">
            <section className="panel entry-panel">
              <div className="panel-number">01</div>
              <h2>创建房间</h2>
              <p>生成一个私密邀请码，发给一起游戏的朋友。</p>
              <label>
                玩家名称
                <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={16} placeholder="例如：城堡骑士" onKeyDown={(event) => event.key === 'Enter' && !busy && void createRoom()} />
              </label>
              <button className="button primary full" disabled={busy || !playerName.trim() || !coreInfo?.supported} onClick={() => void createRoom()}>
                {busy ? '正在创建虚拟网络…' : '创建房间'}
              </button>
            </section>

            <section className="panel entry-panel">
              <div className="panel-number">02</div>
              <h2>加入房间</h2>
              <p>粘贴朋友的邀请码，自动完成加密组网。</p>
              <label>
                房间邀请码
                <textarea value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="粘贴 PT1. 开头的邀请码" rows={3} />
              </label>
              <button className="button secondary full" disabled={busy || !playerName.trim() || !inviteCode.trim() || !coreInfo?.supported} onClick={() => void joinRoom()}>
                {busy ? '正在加入虚拟网络…' : '加入房间'}
              </button>
            </section>
          </div>
        ) : (
          <>
            <section className="panel room-panel">
              <div className="room-heading">
                <div>
                  <div className="eyebrow">PRIVATE GAME NETWORK</div>
                  <h2>{status.isHost ? '你的游戏房间' : '已加入游戏房间'}</h2>
                </div>
                <button className="button ghost danger" disabled={busy} onClick={() => void run(async () => setStatus(await window.playTogether.leaveRoom()))}>离开房间</button>
              </div>

              <div className="room-info-grid">
                <div className="info-block ip-block">
                  <span className="info-label">{status.isHost ? '你的虚拟 IP（建房地址）' : '房主虚拟 IP'}</span>
                  <div className="copy-line">
                    <strong>{hostIp || '正在分配…'}</strong>
                    <button className="icon-button" title="复制 IP" disabled={!hostIp} onClick={() => void copy(hostIp, 'ip')}><CopyIcon /></button>
                  </div>
                  <span className="copy-feedback">{copied === 'ip' ? '已复制' : status.isHost ? '加入者在游戏中连接这个地址' : '在游戏 TCP/IP 页面输入这个地址'}</span>
                </div>
                <div className="info-block">
                  <span className="info-label">你的虚拟 IP</span>
                  <strong>{status.virtualIp || '正在分配…'}</strong>
                  <span className="muted">由组网核心自动分配</span>
                </div>
                <div className="info-block">
                  <span className="info-label">网络状态</span>
                  <strong>{onlineMembers > 0 ? `${onlineMembers + 1} 名成员在线` : '等待成员'}</strong>
                  <span className="muted">优先 P2P，失败时自动中继</span>
                </div>
              </div>

              <details className="invite-details">
                <summary>分享房间邀请码</summary>
                <div className="invite-share">
                  <textarea readOnly value={status.inviteCode} rows={2} onFocus={(event) => event.target.select()} />
                  <button className="button secondary" onClick={() => void copy(status.inviteCode, 'invite')}>{copied === 'invite' ? '已复制' : '复制邀请码'}</button>
                </div>
                <p>邀请码包含加入此私密网络所需的密钥，只发给信任的朋友。</p>
              </details>
            </section>

            <section className="panel members-panel">
              <div className="section-heading">
                <h3>房间成员</h3>
                <span>{status.members.length} 个节点</span>
              </div>
              {status.members.length === 0 ? (
                <div className="empty-state">正在读取网络状态…</div>
              ) : (
                <div className="member-table-wrap">
                  <table>
                    <thead><tr><th>玩家</th><th>虚拟 IP</th><th>连接方式</th><th>延迟</th><th>丢包</th><th /></tr></thead>
                    <tbody>
                      {status.members.map((member) => (
                        <tr key={member.id}>
                          <td><span className="member-name">{member.name}{member.isSelf && <span className="you-tag">你</span>}</span></td>
                          <td className="mono">{member.ip || '分配中'}</td>
                          <td><span className={`route-tag ${member.route.toLowerCase()}`}>{member.route === 'p2p' ? 'P2P 直连' : member.route}</span></td>
                          <td>{member.latency}</td>
                          <td>{member.loss}</td>
                          <td><button className="table-copy" disabled={!member.ip} onClick={() => void copy(member.ip, member.id)}>{copied === member.id ? '已复制' : '复制 IP'}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}

        <section className="panel game-panel">
          <div className="section-heading game-heading">
            <div>
              <div className="eyebrow">GAME ADAPTER</div>
              <h3>英雄无敌 3 · 原版 / 死亡阴影 + HD Mod</h3>
            </div>
            <span className="adapter-tag">TCP/IP</span>
          </div>

          <div className="game-path-row">
            <div className="game-path">
              <span className="info-label">游戏程序</span>
              <span className={gamePath ? 'path-text' : 'path-text missing'}>{gamePath || '尚未选择 Heroes3 HD.exe'}</span>
            </div>
            <button className="button secondary" onClick={() => void selectGame()}><FolderIcon />选择游戏</button>
            <button className="button primary" disabled={!gamePath || busy} onClick={() => void run(() => window.playTogether.launchGame())}><PlayIcon />启动游戏</button>
          </div>

          <div className="steps">
            <div className={status.isHost ? 'step active' : 'step'}>
              <span className="step-index">A</span>
              <div><strong>创建游戏的人</strong><p>新游戏 → 多人游戏 → 单人场景 → TCP/IP，然后创建主机。把自己的虚拟 IP 告诉加入者。</p></div>
            </div>
            <div className={!status.isHost && inRoom ? 'step active' : 'step'}>
              <span className="step-index">B</span>
              <div><strong>加入游戏的人</strong><p>进入相同的 TCP/IP 页面，输入房主虚拟 IP。双方游戏本体、HD Mod 版本和地图必须一致。</p></div>
            </div>
          </div>
          <p className="firewall-note">Windows 需要管理员权限创建虚拟网卡。首次联机时，请在防火墙中允许 PlayTogether、easytier-core.exe 和 Heroes3 HD.exe 的专用网络通信。应用已启用 UDP 广播中继，但手动输入 IP 是首版的主连接方式。</p>
        </section>
      </main>

      <footer>
        <span>仅转发游戏虚拟网段，不接管默认网关或系统 DNS</span>
        <span>发现 / 中继节点：{coreInfo?.peer || '读取中'}</span>
      </footer>
    </div>
  );
}

function NetworkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="2.5" /><circle cx="19" cy="5" r="2.5" /><circle cx="19" cy="19" r="2.5" /><path d="m7.3 10.9 9.4-4.7M7.3 13.1l9.4 4.7" /></svg>;
}

function CopyIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
}

function FolderIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>;
}

function PlayIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7Z" /></svg>;
}

export default App;
