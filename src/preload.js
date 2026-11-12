const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('xstation', {
  listItems: () => ipcRenderer.invoke('library:list'),
  addItem: (kind) => ipcRenderer.invoke('item:add', kind),
  launchItem: (id, asAdmin) => ipcRenderer.invoke('item:launch', id, asAdmin),
  removeItem: (id) => ipcRenderer.invoke('item:remove', id),
  chooseItemIcon: (id) => ipcRenderer.invoke('item:choose-icon', id),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
  setPin: (pin) => ipcRenderer.invoke('settings:set-pin', pin),
  verifyPin: (pin) => ipcRenderer.invoke('settings:verify-pin', pin),
  chooseProfileImage: () => ipcRenderer.invoke('profile:choose-image'),
  openDataFolder: () => ipcRenderer.invoke('app:open-folder'),
  onSessionEnded: (callback) => ipcRenderer.on('session:ended', (_event, data) => callback(data)),
  onLaunchError: (callback) => ipcRenderer.on('launch:error', (_event, data) => callback(data))
});
