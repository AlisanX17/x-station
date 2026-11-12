const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');

let win;
const dataFile = () => path.join(app.getPath('userData'), 'library.json');

async function extractFileIcon(filePath) {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.isEmpty() ? null : icon.toDataURL();
  } catch {
    return null;
  }
}

async function readLibrary() {
  try {
    const items = JSON.parse(await fs.readFile(dataFile(), 'utf8'));
    let changed = false;
    // Upgrade existing library entries so games added before this feature also get icons.
    for (const item of items) {
      if (!item.iconData && item.path) {
        item.iconData = await extractFileIcon(item.path);
        if (item.iconData) changed = true;
      }
    }
    if (changed) await writeLibrary(items);
    return items;
  } catch {
    return [];
  }
}
async function writeLibrary(items) {
  await fs.mkdir(path.dirname(dataFile()), { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(items, null, 2), 'utf8');
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1050, minHeight: 700,
    backgroundColor: '#070b14', autoHideMenuBar: true,
    title: 'X Station',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('library:list', readLibrary);
  ipcMain.handle('game:add', async (_event, kind) => {
    const filters = kind === 'installer'
      ? [{ name: 'Windows installers', extensions: ['exe', 'msi'] }]
      : [{ name: 'Windows games', extensions: ['exe', 'com', 'bat'] }];
    const result = await dialog.showOpenDialog(win, {
      title: kind === 'installer' ? 'Select game installer' : 'Select game executable',
      properties: ['openFile'], filters
    });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const base = path.basename(filePath, path.extname(filePath));
    const items = await readLibrary();
    const iconData = await extractFileIcon(filePath);
    const item = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      name: base.replace(/[._-]+/g, ' ').trim(), path: filePath, iconData,
      kind, addedAt: new Date().toISOString(), lastPlayed: null
    };
    items.unshift(item);
    await writeLibrary(items);
    return item;
  });
  ipcMain.handle('game:launch', async (_event, id) => {
    const items = await readLibrary();
    const item = items.find(x => x.id === id);
    if (!item) return { ok: false, message: 'Game not found.' };
    try {
      const stat = await fs.stat(item.path);
      if (!stat.isFile()) throw new Error('Selected path is not a file.');
      const error = await shell.openPath(item.path);
      if (error) throw new Error(error);
      item.lastPlayed = new Date().toISOString();
      await writeLibrary(items);
      return { ok: true };
    } catch (error) {
      return { ok: false, message: error.message || 'Could not open this file.' };
    }
  });
  ipcMain.handle('game:remove', async (_event, id) => {
    const items = (await readLibrary()).filter(x => x.id !== id);
    await writeLibrary(items);
    return items;
  });
  ipcMain.handle('app:open-folder', async () => shell.openPath(app.getPath('userData')));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
