const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

let win;
const dataDir = () => app.getPath('userData');
const dataFile = () => path.join(dataDir(), 'library.json');
const settingsFile = () => path.join(dataDir(), 'settings.json');
const activeSessions = new Map();

async function extractFileIcon(filePath) {
  try {
    const icon = await app.getFileIcon(filePath, { size: 'large' });
    return icon.isEmpty() ? null : icon.toDataURL();
  } catch { return null; }
}
async function readLibrary() {
  try {
    const items = JSON.parse(await fs.readFile(dataFile(), 'utf8'));
    let changed = false;
    for (const item of items) {
      if (!item.iconData && item.path && item.kind !== 'installer') {
        item.iconData = await extractFileIcon(item.path);
        if (item.iconData) changed = true;
      }
      item.totalPlayMs = Number(item.totalPlayMs || 0);
      item.kind = item.kind || 'game';
    }
    if (changed) await writeLibrary(items);
    return items;
  } catch { return []; }
}
async function writeLibrary(items) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(dataFile(), JSON.stringify(items, null, 2), 'utf8');
}
async function readSettings() {
  try { return JSON.parse(await fs.readFile(settingsFile(), 'utf8')); }
  catch { return { language: 'en', theme: 'blue', profileName: 'PLAYER ONE', profileImage: null, pinSalt: null, pinHash: null }; }
}
async function writeSettings(settings) {
  await fs.mkdir(dataDir(), { recursive: true });
  await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2), 'utf8');
}
function hashPin(pin, salt) { return crypto.scryptSync(pin, salt, 64).toString('hex'); }
function safeItem(item) { const { path: filePath, ...rest } = item; return { ...rest, path: filePath }; }
function finishSession(id, startedAt) {
  const session = activeSessions.get(id);
  if (!session || session.startedAt !== startedAt) return;
  activeSessions.delete(id);
  const elapsed = Math.max(0, Date.now() - startedAt);
  readLibrary().then(async items => {
    const item = items.find(x => x.id === id);
    if (!item) return;
    item.totalPlayMs = Number(item.totalPlayMs || 0) + elapsed;
    item.lastPlayed = new Date().toISOString();
    await writeLibrary(items);
    if (win && !win.isDestroyed()) win.webContents.send('session:ended', { id, totalPlayMs: item.totalPlayMs, elapsed });
  }).catch(() => {});
}
function psQuote(value) { return "'" + String(value).replace(/'/g, "''") + "'"; }

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1050, minHeight: 700,
    backgroundColor: '#070b14', autoHideMenuBar: true, title: 'X Station',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('library:list', readLibrary);
  ipcMain.handle('settings:get', readSettings);
  ipcMain.handle('settings:save', async (_e, patch) => {
    const settings = await readSettings();
    const allowed = ['language', 'theme', 'profileName', 'profileImage'];
    for (const key of allowed) if (Object.prototype.hasOwnProperty.call(patch, key)) settings[key] = patch[key];
    await writeSettings(settings);
    return settings;
  });
  ipcMain.handle('settings:set-pin', async (_e, pin) => {
    const settings = await readSettings();
    if (!pin) { settings.pinSalt = null; settings.pinHash = null; await writeSettings(settings); return true; }
    if (!/^\d{4,8}$/.test(String(pin))) return false;
    settings.pinSalt = crypto.randomBytes(16).toString('hex');
    settings.pinHash = hashPin(String(pin), settings.pinSalt);
    await writeSettings(settings); return true;
  });
  ipcMain.handle('settings:verify-pin', async (_e, pin) => {
    const s = await readSettings();
    if (!s.pinHash || !s.pinSalt) return true;
    const candidate = Buffer.from(hashPin(String(pin), s.pinSalt), 'hex');
    const expected = Buffer.from(s.pinHash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  });
  ipcMain.handle('profile:choose-image', async () => {
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Profile image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = result.filePaths[0];
    const ext = path.extname(file).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    const data = await fs.readFile(file);
    if (data.length > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
    return `data:${mime};base64,${data.toString('base64')}`;
  });
  ipcMain.handle('item:add', async (_event, kind) => {
    const isInstaller = kind === 'installer';
    const filters = isInstaller ? [{ name: 'Windows installers', extensions: ['exe', 'msi'] }] : [{ name: kind === 'app' ? 'Windows applications' : 'Windows games', extensions: ['exe', 'com', 'bat', 'cmd'] }];
    const result = await dialog.showOpenDialog(win, { title: isInstaller ? 'Select installer' : kind === 'app' ? 'Select application executable' : 'Select game executable', properties: ['openFile'], filters });
    if (result.canceled || !result.filePaths[0]) return null;
    const filePath = result.filePaths[0];
    const base = path.basename(filePath, path.extname(filePath));
    const items = await readLibrary();
    const iconData = isInstaller ? null : await extractFileIcon(filePath);
    const item = { id: `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`, name: base.replace(/[._-]+/g, ' ').trim(), path: filePath, iconData, kind, addedAt: new Date().toISOString(), lastPlayed: null, totalPlayMs: 0 };
    items.unshift(item); await writeLibrary(items); return item;
  });
  ipcMain.handle('item:choose-icon', async (_event, id) => {
    const result = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: [{ name: 'Icon and image files', extensions: ['ico', 'png', 'jpg', 'jpeg', 'webp'] }] });
    if (result.canceled || !result.filePaths[0]) return null;
    const file = result.filePaths[0]; const ext = path.extname(file).toLowerCase();
    const mime = ext === '.ico' ? 'image/x-icon' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
    const data = await fs.readFile(file); if (data.length > 5 * 1024 * 1024) throw new Error('Image must be 5 MB or smaller.');
    const items = await readLibrary(); const item = items.find(x => x.id === id); if (!item) return null;
    item.iconData = `data:${mime};base64,${data.toString('base64')}`; await writeLibrary(items); return item;
  });
  ipcMain.handle('item:launch', async (_event, id, asAdmin = false) => {
    const items = await readLibrary(); const item = items.find(x => x.id === id);
    if (!item) return { ok: false, message: 'Item not found.' };
    try {
      await fs.access(item.path);
      const startedAt = Date.now();
      if (item.kind === 'installer' || path.extname(item.path).toLowerCase() === '.msi') {
        const error = await shell.openPath(item.path);
        if (error) throw new Error(error);
        item.lastPlayed = new Date().toISOString(); await writeLibrary(items);
        return { ok: true, noTrack: true };
      }
      let child;
      if (asAdmin) {
        if (process.platform !== 'win32') return { ok: false, message: 'Administrator launch is supported on Windows.' };
        const command = `$p = Start-Process -FilePath ${psQuote(item.path)} -Verb RunAs -PassThru; $p.WaitForExit()`;
        child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, stdio: 'ignore' });
      } else {
        child = spawn(item.path, [], { cwd: path.dirname(item.path), detached: false, windowsHide: false, stdio: 'ignore' });
      }
      child.once('error', error => {
        const session = activeSessions.get(id);
        if (session && session.startedAt === startedAt) { activeSessions.delete(id); if (win && !win.isDestroyed()) win.webContents.send('launch:error', { id, message: error.message }); }
      });
      child.once('close', () => finishSession(id, startedAt));
      activeSessions.set(id, { startedAt, child });
      item.lastPlayed = new Date().toISOString(); await writeLibrary(items);
      return { ok: true, startedAt };
    } catch (error) { return { ok: false, message: error.message || 'Could not launch this file.' }; }
  });
  ipcMain.handle('item:remove', async (_event, id) => { const items = (await readLibrary()).filter(x => x.id !== id); await writeLibrary(items); return items; });
  ipcMain.handle('app:open-folder', async () => shell.openPath(dataDir()));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
