// Tsumi Desktop — Electron main process.
//
// The desktop app is a thin native shell around the deployed Tsumi website
// PLUS a native mpv player for video. We deliberately load the live site (not a
// bundled copy) so the Real-Debrid BYO-key flow keeps the key server-side and
// UI updates ship via the normal web deploy. The ONLY thing the shell adds is
// smooth playback: it hands mpv the keyless direct RD link so raw mkv plays
// natively with no transcode — the fix for the browser's ~0:30 stutter.
//
// The window is frameless + maximized for an app-like, chrome-free experience;
// our own React title bar (components/desktop/title-bar.tsx) draws the window
// controls. A `tsumi://` protocol lets the website's "Open in app" button deep
// link straight into the running app.

const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
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

// Only ONE instance may run — protocol activations (tsumi://…) on Windows launch
// a second process and pass the URL via argv; we route it into the live window
// instead of opening a duplicate app.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  let mainWindow = null;
  let pendingDeepLink = null;

  // No native application menu — the frameless window has our own title bar.
  Menu.setApplicationMenu(null);

  // Register the tsumi:// scheme so the website can deep-link into the app.
  if (process.defaultApp) {
    // In dev (`electron .`) the OS must re-launch us with the script path.
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient('tsumi', process.execPath, [
        path.resolve(process.argv[1]),
      ]);
    }
  } else {
    app.setAsDefaultProtocolClient('tsumi');
  }

  // tsumi://watch/123/4  →  /watch/123/4
  function deepLinkToPath(url) {
    const m = /^tsumi:\/\/(.*)$/i.exec(String(url).trim());
    if (!m) return null;
    const rest = m[1].replace(/^\/+/, '').replace(/\/+$/, '');
    return '/' + rest;
  }

  function targetForDeepLink(url) {
    const p = deepLinkToPath(url);
    if (!p || p === '/') return null;
    return APP_URL.replace(/\/$/, '') + p;
  }

  function navigateDeepLink(url) {
    const target = targetForDeepLink(url);
    if (!target) return;
    if (mainWindow) {
      mainWindow.loadURL(target);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    } else {
      pendingDeepLink = target;
    }
  }

  // The URL the app should open with on a cold start (protocol launch passes it
  // in argv on Windows/Linux), defaulting to the app home.
  function initialUrl() {
    const arg = process.argv.find((a) => a.startsWith('tsumi://'));
    return (arg && targetForDeepLink(arg)) || APP_URL;
  }

  // Windows/Linux: a second launch (incl. protocol activation) lands here.
  app.on('second-instance', (_evt, argv) => {
    const url = argv.find((a) => a.startsWith('tsumi://'));
    if (url) {
      navigateDeepLink(url);
    } else if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // macOS: protocol activation arrives as an event.
  app.on('open-url', (evt, url) => {
    evt.preventDefault();
    navigateDeepLink(url);
  });

  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 900,
      minHeight: 600,
      backgroundColor: '#0A0A0F',
      // Frameless: no OS title bar / menu strip. Our React title bar draws the
      // window controls and a draggable region.
      frame: false,
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

    // Open maximized — the app fills the screen like a native media app.
    mainWindow.maximize();

    mainWindow.loadURL(pendingDeepLink || initialUrl());
    pendingDeepLink = null;

    // Keep the renderer's title-bar maximize/restore icon in sync.
    mainWindow.on('maximize', () =>
      mainWindow.webContents.send('window:maximized', true),
    );
    mainWindow.on('unmaximize', () =>
      mainWindow.webContents.send('window:maximized', false),
    );

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

  // ── Window controls (frameless → renderer drives min/max/close) ──
  ipcMain.on('window:minimize', () => mainWindow && mainWindow.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow && mainWindow.close());

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
}
