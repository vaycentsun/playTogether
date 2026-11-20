import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInvite, parseInvite } from './invite.js';
import { EasyTierService, DEFAULT_PEER } from './easytier.js';
import { detectGame, launchGame, validateGameExecutable } from './game.js';
import { SettingsStore } from './settings.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const settings = new SettingsStore(path.join(app.getPath('userData'), 'settings.json'));
let mainWindow;
let service;

function coreDirectory() {
  if (process.env.PLAYTOGETHER_EASYTIER_DIR) {
    return process.env.PLAYTOGETHER_EASYTIER_DIR;
  }
  return app.isPackaged
    ? path.join(process.resourcesPath, 'easytier')
    : path.join(app.getAppPath(), 'core', 'win32-x64');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1060,
    height: 790,
    minWidth: 880,
    minHeight: 680,
    backgroundColor: '#0b1017',
    title: 'PlayTogether',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(directory, '..', 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (process.env.PLAYTOGETHER_DEV_URL) {
    void mainWindow.loadURL(process.env.PLAYTOGETHER_DEV_URL);
  } else {
    void mainWindow.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'));
  }
}

function registerIpc() {
  ipcMain.handle('room:create', async (_event, playerName) => {
    await service.leaveIfNeeded();
    return service.start(createInvite(), 'host', playerName);
  });

  ipcMain.handle('room:join', async (_event, inviteCode, playerName) => {
    const invite = parseInvite(inviteCode);
    await service.leaveIfNeeded();
    return service.start(invite, 'guest', playerName);
  });

  ipcMain.handle('room:leave', () => service.stop());
  ipcMain.handle('room:status', () => service.getStatus());
  ipcMain.handle('core:info', () => service.getCoreInfo());

  ipcMain.handle('game:select', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 Heroes3 HD.exe',
      properties: ['openFile'],
      filters: [{ name: '英雄无敌 3 HD Mod', extensions: ['exe'] }],
    });
    if (result.canceled || !result.filePaths[0]) {
      return '';
    }
    const gamePath = await validateGameExecutable(result.filePaths[0]);
    await settings.set('gamePath', gamePath);
    return gamePath;
  });

  ipcMain.handle('game:detect', async () => {
    const detected = await detectGame();
    if (detected) {
      await settings.set('gamePath', detected);
    }
    return detected;
  });

  ipcMain.handle('game:get-path', () => settings.get('gamePath') || '');
  ipcMain.handle('game:launch', async () => {
    const gamePath = settings.get('gamePath');
    if (!gamePath) {
      throw new Error('请先选择 Heroes3 HD.exe');
    }
    await launchGame(gamePath);
  });
}

app.whenReady().then(async () => {
  await settings.load();
  service = new EasyTierService({
    coreDirectory: coreDirectory(),
    peer: process.env.PLAYTOGETHER_PEER_URL || DEFAULT_PEER,
  });
  service.leaveIfNeeded = async () => {
    if (service.child || service.starting) {
      throw new Error('当前正在组网，请先离开房间再重试');
    }
  };
  service.on('status', (status) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('room:status', status);
    }
  });
  registerIpc();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', (event) => {
  if (!service?.child) {
    return;
  }
  event.preventDefault();
  void service.stop().finally(() => app.quit());
});
