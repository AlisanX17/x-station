const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('xstation', {
  listGames: () => ipcRenderer.invoke('library:list'),
  addGame: (kind) => ipcRenderer.invoke('game:add', kind),
  launchGame: (id) => ipcRenderer.invoke('game:launch', id),
  removeGame: (id) => ipcRenderer.invoke('game:remove', id),
  openDataFolder: () => ipcRenderer.invoke('app:open-folder')
});
