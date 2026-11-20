import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { EasyTierService, findAvailableListenerPort } from '../../electron/main/easytier.js';
import { createInvite } from '../../electron/main/invite.js';

const coreDirectory = process.env.PLAYTOGETHER_TEST_CORE_DIR;

test('两个真实 EasyTier 核心通过本地节点互联并正常退出', { skip: !coreDirectory, timeout: 60000 }, async (context) => {
  const listenerPort = await findAvailableListenerPort();
  const invite = createInvite();
  const host = new EasyTierService({
    platform: 'darwin', coreDirectory, noTun: true, listenerPort,
    peer: `tcp://127.0.0.1:${listenerPort}`,
  });
  const guest = new EasyTierService({
    platform: 'darwin', coreDirectory, noTun: true,
    peer: `tcp://127.0.0.1:${listenerPort}`,
  });
  context.after(async () => {
    await guest.stop();
    await host.stop();
  });

  await host.start(invite, 'host', 'IntegrationHost');
  await guest.start(invite, 'guest', 'IntegrationGuest');

  const deadline = Date.now() + 15000;
  let hostPeers = [];
  while (Date.now() < deadline) {
    const output = await host.execFileAsync(path.join(coreDirectory, 'easytier-cli'), [
      '--rpc-portal', `127.0.0.1:${host.rpcPort}`, '--output', 'json', 'peer', 'list',
    ]);
    hostPeers = JSON.parse(output);
    if (hostPeers.length >= 2) break;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  assert.ok(hostPeers.length >= 2, `期望至少两个节点，实际：${JSON.stringify(hostPeers)}`);
  assert.ok(hostPeers.some((peer) => peer.hostname === 'PT_H_IntegrationHost'));
  assert.ok(hostPeers.some((peer) => peer.hostname === 'PT_G_IntegrationGuest'));
  assert.equal(host.getCoreInfo().running, true);
  assert.equal(guest.getCoreInfo().running, true);
});
