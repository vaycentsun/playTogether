import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class SettingsStore {
  constructor(filePath) {
    this.filePath = filePath;
    this.values = {};
  }

  async load() {
    try {
      const parsed = JSON.parse(await readFile(this.filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        this.values = parsed;
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.values = {};
      }
    }
    return this.values;
  }

  get(key) {
    return this.values[key];
  }

  async set(key, value) {
    this.values = { ...this.values, [key]: value };
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.tmp`;
    await writeFile(temporaryPath, JSON.stringify(this.values, null, 2), { mode: 0o600 });
    await rename(temporaryPath, this.filePath);
  }
}
