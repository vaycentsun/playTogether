import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectGame, isSupportedGameExecutable, launchGame, validateGameExecutable } from '../../electron/main/game.js';

test('游戏适配器只接受 Heroes3 HD.exe', async () => {
  assert.equal(isSupportedGameExecutable('C:\\Games\\HoMM3\\Heroes3 HD.exe'), true);
  assert.equal(isSupportedGameExecutable('/games/Heroes3 HD.exe'), true);
  assert.equal(isSupportedGameExecutable('C:\\Games\\Heroes3.exe'), false);
  await assert.rejects(() => validateGameExecutable('C:\\Games\\Heroes3.exe'), /Heroes3 HD.exe/);
});

test('可以从常见 GOG 目录检测游戏并启动', async (context) => {
  const root = await mkdtemp(path.join(tmpdir(), 'playtogether-game-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  const gameDirectory = path.join(root, 'GOG Galaxy', 'Games', 'HoMM 3 Complete');
  await mkdir(gameDirectory, { recursive: true });
  const gamePath = path.join(gameDirectory, 'Heroes3 HD.exe');
  await writeFile(gamePath, 'test');

  assert.equal(await detectGame({ 'ProgramFiles(x86)': root }, 'win32'), gamePath);
  assert.equal(await validateGameExecutable(gamePath), gamePath);

  const child = new EventEmitter();
  child.unref = () => {};
  let options;
  const launch = launchGame(gamePath, (_executable, args, spawnOptions) => {
    assert.deepEqual(args, []);
    options = spawnOptions;
    process.nextTick(() => child.emit('spawn'));
    return child;
  });
  await launch;
  assert.equal(options.cwd, gameDirectory);
  assert.equal(options.detached, true);
  assert.equal(options.stdio, 'ignore');
});

test('非 Windows 平台不扫描 Windows 游戏目录', async () => {
  assert.equal(await detectGame({ ProgramFiles: '/unused' }, 'darwin'), '');
});
