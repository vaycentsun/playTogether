import { randomBytes } from 'node:crypto';

const PREFIX = 'PT1.';
const NETWORK_NAME_PATTERN = /^pt_[a-f0-9]{24}$/;
const SECRET_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function createInvite() {
  return {
    networkName: `pt_${randomBytes(12).toString('hex')}`,
    networkSecret: randomBytes(32).toString('base64url'),
  };
}

export function encodeInvite(invite) {
  validateInvite(invite);
  return PREFIX + Buffer.from(JSON.stringify({
    v: 1,
    n: invite.networkName,
    s: invite.networkSecret,
  })).toString('base64url');
}

export function parseInvite(value) {
  if (typeof value !== 'string') {
    throw new Error('邀请码格式不正确');
  }

  const normalized = value.trim();
  if (normalized.length > 2048 || !normalized.startsWith(PREFIX)) {
    throw new Error('邀请码格式不正确，请完整复制 PT1. 开头的内容');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(normalized.slice(PREFIX.length), 'base64url').toString('utf8'));
  } catch {
    throw new Error('邀请码无法读取，请重新复制');
  }

  if (payload?.v !== 1 || payload.n === undefined || payload.s === undefined) {
    throw new Error('邀请码版本或内容不正确');
  }

  const invite = { networkName: payload.n, networkSecret: payload.s };
  validateInvite(invite);
  return invite;
}

export function validateInvite(invite) {
  if (!NETWORK_NAME_PATTERN.test(invite.networkName) || !SECRET_PATTERN.test(invite.networkSecret)) {
    throw new Error('邀请码中的网络标识或密钥不正确');
  }
}
