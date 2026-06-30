// Tsumi Desktop — Electron main process.
//
// The desktop app is a thin native shell around the deployed Tsumi website
// PLUS a native mpv player for video. We deliberately load the live site (not a
// bundled copy) so the Real-Debrid BYO-key flow keeps the key server-side and
// UI updates ship via the normal web deploy. The ONLY thing the shell adds is
// smooth playback: it hands mpv the keyless direct RD link so raw mkv plays
// natively with no transcode — the fix for the browser's ~0:30 stutter.

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { playMpv, stopMpv, onMpvProgress } = require('./mpv');

// The site the shell wraps.
//  • Packaged app  → your hosted Vercel deployment (PROD_URL below).
//  • Dev (npm run app) → the local dev server.
//  • Override either with the TSUMI_APP_URL env var.
const PROD_URL = 'https://tsumi-rho.vercel.app'; // your Vercel URL
const APP_URL =
  process.env.TSUMI_APP_URL ||
  (app.isPackaged ? PROD_URL : 'http://localhost:3000');

// Brand the app everywhere the OS shows a name (taskbar tooltip, About, etc.).
app.setName('Tsumi');

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0A0A0F',
    autoHideMenuBar: true,
    title: 'Tsumi',
    // Tsumi brand icon (罪) for the window + taskbar — no default Electron logo.
    icon: path.join(__dirname, 'resources', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links (sign-in providers, real-debrid.com, etc.) in the
  // system browser rather than inside the app shell.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(APP_URL)) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Forward mpv playback progress to the renderer so it can persist watch
  // history through the existing saveProgress path.
  onMpvProgress((p) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('mpv:progress', p);
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Renderer asks us to play a direct media URL in mpv.
ipcMain.handle('mpv:play', async (_evt, { url, opts }) => {
  try {
    await playMpv(url, opts || {});
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
});

// Renderer asks us to stop mpv (user chose to watch in-window instead).
ipcMain.handle('mpv:stop', () => {
  stopMpv();
  return { ok: true };
});

app.whenReady().then(createWindow);

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
