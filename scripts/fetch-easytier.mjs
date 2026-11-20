import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { access, mkdir, readdir, readFile, rename, rm, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const VERSION = '2.6.4';
const MANIFEST = {
  'win32-x64': {
    asset: `easytier-windows-x86_64-v${VERSION}.zip`,
    assetId: 418406680,
    sha256: '27af91e270e554709b048bd32327fefd2dfce5062ae1e8701af7550c6f525f84',
  },
  'darwin-arm64': {
    asset: `easytier-macos-aarch64-v${VERSION}.zip`,
    assetId: 418406678,
    sha256: '4be1882d1aa36d31c1d6ba0596f2cf8a097e371f8da124212324b2e0f8df7e4b',
  },
  'darwin-x64': {
    asset: `easytier-macos-x86_64-v${VERSION}.zip`,
    assetId: 418406681,
    sha256: '89fc28a6e6995259d76ce3f11775220e8a21c760e94df91a6a9db30a69b6982e',
  },
};

const args = process.argv.slice(2);
const platform = argumentValue('--platform') || 'win32';
const arch = argumentValue('--arch') || 'x64';
const key = `${platform}-${arch}`;
const target = MANIFEST[key];
if (!target) {
  throw new Error(`不支持的核心平台：${key}`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDirectory = path.join(root, 'core', key);
const markerPath = path.join(outputDirectory, '.easytier-version.json');
if (await isCurrentInstallation(markerPath, key)) {
  console.log(`EasyTier ${VERSION} 已就绪：${outputDirectory}`);
  process.exit(0);
}

const cacheDirectory = path.join(root, '.cache', 'downloads');
const archivePath = path.join(cacheDirectory, target.asset);
const temporaryDirectory = path.join(root, '.cache', `extract-${key}`);
await mkdir(cacheDirectory, { recursive: true });
await downloadAndVerify(target, archivePath);
await rm(temporaryDirectory, { recursive: true, force: true });
await mkdir(temporaryDirectory, { recursive: true });
await execFileAsync('tar', ['-xf', archivePath, '-C', temporaryDirectory]);
await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

const files = await listFiles(temporaryDirectory);
const selectedFiles = files.filter((file) => /(?:easytier-(?:core|cli)(?:\.exe)?|[^/\\]+\.(?:dll|sys))$/i.test(file));
if (!selectedFiles.some((file) => /easytier-core(?:\.exe)?$/i.test(file)) || !selectedFiles.some((file) => /easytier-cli(?:\.exe)?$/i.test(file))) {
  throw new Error('下载包中缺少 easytier-core 或 easytier-cli');
}
for (const source of selectedFiles) {
  await cp(source, path.join(outputDirectory, path.basename(source)));
}
await writeFile(markerPath, JSON.stringify({ version: VERSION, platform, arch, sha256: target.sha256 }, null, 2));
await rm(temporaryDirectory, { recursive: true, force: true });
console.log(`EasyTier ${VERSION} 已下载并校验：${outputDirectory}`);

function argumentValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function isCurrentInstallation(filePath, expectedKey) {
  try {
    const marker = JSON.parse(await readFile(filePath, 'utf8'));
    const executable = platform === 'win32' ? 'easytier-core.exe' : 'easytier-core';
    await access(path.join(outputDirectory, executable));
    return marker.version === VERSION && `${marker.platform}-${marker.arch}` === expectedKey && marker.sha256 === target.sha256;
  } catch {
    return false;
  }
}

async function downloadAndVerify(manifest, destination) {
  if (!await matchesHash(destination, manifest.sha256)) {
    const url = `https://api.github.com/repos/EasyTier/EasyTier/releases/assets/${manifest.assetId}`;
    console.log(`正在下载 EasyTier ${VERSION}（${manifest.asset}）`);
    await mkdir(path.dirname(destination), { recursive: true });
    const temporary = `${destination}.part`;
    await rm(temporary, { force: true });
    await execFileAsync('curl', [
      '-fL', '--retry', '3', '--retry-all-errors', '--connect-timeout', '30',
      '-H', 'Accept: application/octet-stream', '--output', temporary, url,
    ]);
    await rename(temporary, destination);
  }
  if (!await matchesHash(destination, manifest.sha256)) {
    await rm(destination, { force: true });
    throw new Error('EasyTier 下载包 SHA-256 校验失败，已删除该文件');
  }
}

async function matchesHash(filePath, expected) {
  try {
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(filePath)) {
      hash.update(chunk);
    }
    return hash.digest('hex') === expected;
  } catch {
    return false;
  }
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await listFiles(fullPath));
    } else {
      result.push(fullPath);
    }
  }
  return result;
}
