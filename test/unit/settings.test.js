import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SettingsStore } from '../../electron/main/settings.js';

test('设置可以持久化并重新读取', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'playtogether-settings-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const filePath = path.join(root, 'settings.json');
  const store = new SettingsStore(filePath);
  await store.load();
  await store.set('gamePath', 'C:\\Games\\Heroes3 HD.exe');

  const restored = new SettingsStore(filePath);
  await restored.load();
  assert.equal(restored.get('gamePath'), 'C:\\Games\\Heroes3 HD.exe');
  assert.deepEqual(JSON.parse(await readFile(filePath, 'utf8')), { gamePath: 'C:\\Games\\Heroes3 HD.exe' });
});
