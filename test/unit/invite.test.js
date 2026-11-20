import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvite, encodeInvite, parseInvite } from '../../electron/main/invite.js';

test('邀请码可以往返解析且不暴露额外字段', () => {
  const invite = createInvite();
  const encoded = encodeInvite(invite);
  assert.match(encoded, /^PT1\.[A-Za-z0-9_-]+$/);
  assert.deepEqual(parseInvite(encoded), invite);
});

test('邀请码允许首尾空白但拒绝不完整内容', () => {
  const encoded = encodeInvite(createInvite());
  assert.deepEqual(parseInvite(`\n ${encoded} \t`), parseInvite(encoded));
  assert.throws(() => parseInvite(encoded.slice(0, -4)), /邀请码/);
  assert.throws(() => parseInvite('PT2.invalid'), /PT1/);
});

test('邀请码拒绝被替换的网络标识和密钥', () => {
  const invite = createInvite();
  assert.throws(() => encodeInvite({ ...invite, networkName: 'public' }), /网络标识或密钥/);
  assert.throws(() => encodeInvite({ ...invite, networkSecret: 'short' }), /网络标识或密钥/);
  assert.throws(() => parseInvite(`PT1.${Buffer.from('{"v":1,"n":"pt_000000000000000000000000","s":"short"}').toString('base64url')}`));
});

test('每次创建的房间使用不同的网络标识和密钥', () => {
  const first = createInvite();
  const second = createInvite();
  assert.notEqual(first.networkName, second.networkName);
  assert.notEqual(first.networkSecret, second.networkSecret);
  assert.equal(Buffer.from(first.networkSecret, 'base64url').length, 32);
});
