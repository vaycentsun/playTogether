import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePeerHostname, isValidIpv4, normalizePlayerName, toMember } from '../../electron/main/peers.js';

test('玩家名称会清理换行并限制长度', () => {
  assert.equal(normalizePlayerName('  玩家\nA\t  '), '玩家A');
  assert.equal(normalizePlayerName('一二三四五六七八九十一二三四五六七八九十'), '一二三四五六七八九十一二三四五六');
  assert.throws(() => normalizePlayerName('  '), /玩家名称/);
});

test('节点名称保留创建者和加入者角色', () => {
  assert.equal(encodePeerHostname('host', 'Castle'), 'PT_H_Castle');
  assert.equal(encodePeerHostname('guest', 'Rampart'), 'PT_G_Rampart');
});

test('成员解析只接受合法 IPv4 并识别自己', () => {
  const member = toMember({ id: '42', hostname: 'PT_H_Castle', ipv4: '10.126.126.1', cost: 'Local', lat_ms: '-', loss_rate: '-' }, 42);
  assert.deepEqual(member, {
    id: '42', name: 'Castle', role: 'host', ip: '10.126.126.1', isSelf: true,
    route: '本机', latency: '—', loss: '—',
  });
  assert.equal(toMember({ id: 7, hostname: 'PT_G_Guest', ipv4: 'invalid', cost: 'p2p', lat_ms: 23.456, loss_rate: 0.25 }, 42).ip, '');
  assert.equal(toMember({ id: 7, hostname: 'PT_G_Guest', ipv4: '10.0.0.2', cost: 'p2p', lat_ms: 23.456, loss_rate: 0.25 }, 42).latency, '23.5 ms');
});

test('IPv4 校验拒绝越界和残缺地址', () => {
  assert.equal(isValidIpv4('10.126.126.1'), true);
  assert.equal(isValidIpv4('256.1.1.1'), false);
  assert.equal(isValidIpv4('10.0.1'), false);
  assert.equal(isValidIpv4(''), false);
});
