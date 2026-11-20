const IPV4_PATTERN = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function normalizePlayerName(value) {
  const name = typeof value === 'string' ? value.trim().replace(/[\r\n\t]/g, '').slice(0, 16) : '';
  if (!name) {
    throw new Error('请输入玩家名称');
  }
  return name;
}

export function encodePeerHostname(role, playerName) {
  return `${role === 'host' ? 'PT_H' : 'PT_G'}_${normalizePlayerName(playerName)}`;
}

export function isValidIpv4(value) {
  return IPV4_PATTERN.test(value) && value.split('.').every((part) => Number(part) <= 255);
}

export function toMember(peer, selfPeerId) {
  const isSelf = String(peer.id) === String(selfPeerId);
  const role = peer.hostname?.startsWith('PT_H_') ? 'host' : 'guest';
  const fallbackName = isSelf ? '当前玩家' : '玩家';
  const name = peer.hostname?.replace(/^PT_[HG]_/, '') || fallbackName;

  return {
    id: String(peer.id),
    name,
    role,
    ip: isValidIpv4(peer.ipv4) ? peer.ipv4 : '',
    isSelf,
    route: peer.cost === 'Local' ? '本机' : String(peer.cost || '未知'),
    latency: formatMetric(peer.lat_ms, 'ms'),
    loss: formatMetric(peer.loss_rate, '%'),
  };
}

function formatMetric(value, unit) {
  if (value === undefined || value === null || value === '-' || value === '*') {
    return '—';
  }
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number * 10) / 10} ${unit}` : '—';
}
