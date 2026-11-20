import { access } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const EXECUTABLE_NAME = 'heroes3 hd.exe';

export function isSupportedGameExecutable(filePath) {
  return typeof filePath === 'string' && filePath.split(/[\\/]/).pop()?.toLowerCase() === EXECUTABLE_NAME;
}

export async function validateGameExecutable(filePath) {
  if (!isSupportedGameExecutable(filePath)) {
    throw new Error('请选择 Heroes3 HD.exe，而不是 Steam 官方 HD Edition 或其他启动器');
  }
  try {
    await access(filePath);
  } catch {
    throw new Error('游戏文件不存在，请重新选择 Heroes3 HD.exe');
  }
  return filePath;
}

export async function detectGame(environment = process.env, platform = process.platform) {
  if (platform !== 'win32') {
    return '';
  }

  const roots = [
    environment['ProgramFiles(x86)'],
    environment.ProgramFiles,
    environment.GOG_GAMES,
  ].filter(Boolean);
  const relativePaths = [
    ['GOG Galaxy', 'Games', 'HoMM 3 Complete', 'Heroes3 HD.exe'],
    ['GOG Galaxy', 'Games', 'Heroes 3 Complete', 'Heroes3 HD.exe'],
    ['GOG Games', 'HoMM 3 Complete', 'Heroes3 HD.exe'],
    ['Heroes3', 'Heroes3 HD.exe'],
  ];

  for (const root of roots) {
    for (const segments of relativePaths) {
      const candidate = path.join(root, ...segments);
      try {
        await access(candidate);
        return candidate;
      } catch {
      }
    }
  }
  return '';
}

export async function launchGame(filePath, spawnImpl = spawn) {
  await validateGameExecutable(filePath);
  const child = spawnImpl(filePath, [], {
    cwd: path.dirname(filePath),
    detached: true,
    stdio: 'ignore',
    windowsHide: false,
  });
  await new Promise((resolve, reject) => {
    child.once('spawn', resolve);
    child.once('error', reject);
  });
  child.unref();
}
