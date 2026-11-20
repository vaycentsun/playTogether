const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('playTogether', {
  createRoom: (playerName) => ipcRenderer.invoke('room:create', playerName),
  joinRoom: (inviteCode, playerName) => ipcRenderer.invoke('room:join', inviteCode, playerName),
  leaveRoom: () => ipcRenderer.invoke('room:leave'),
  getRoomStatus: () => ipcRenderer.invoke('room:status'),
  onRoomStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on('room:status', listener);
    return () => ipcRenderer.removeListener('room:status', listener);
  },
  selectGame: () => ipcRenderer.invoke('game:select'),
  detectGame: () => ipcRenderer.invoke('game:detect'),
  getGamePath: () => ipcRenderer.invoke('game:get-path'),
  launchGame: () => ipcRenderer.invoke('game:launch'),
  getCoreInfo: () => ipcRenderer.invoke('core:info'),
});
