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
const {
  playMpv,
  stopMpv,
  seekMpv,
  onMpvProgress,
  onMpvMessage,
} = require('./mpv');
const { streamTorrent, stopTorrents } = require('./torrent');

// ── Make the embedded mpv video actually visible ──────────────────────────
// mpv renders into a child window via --wid. With Chromium's GPU compositing
// (DirectComposition) on Windows, Electron paints its own surface OVER that
// child window, so you get mpv's audio but a black picture. Disabling hardware
// compositing makes Electron paint into the window DC instead, letting mpv's
// child window show on top. Playback is mpv-native, so the UI losing GPU accel
// has no effect on video smoothness.
app.disableHardwareAcceleration();
// Stop Electron from treating the borderless video host as "occluded" and
// skipping paints, which can also blank the embedded surface.
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

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
  // Borderless child window that hosts the embedded mpv video surface, plus the
  // last stage rectangle (renderer CSS pixels) so we can re-place it when the
  // main window moves / resizes.
  let videoWin = null;
  let lastVideoRect = null;

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

  // ── Embedded mpv video surface ──────────────────────────────────────────
  // mpv renders into this borderless child window (passed as --wid). We float
  // it over the watch page's "stage" div and keep it aligned as the window
  // moves / resizes / scrolls, so the player feels part of the page.

  // Convert the OS window handle into the integer mpv's --wid expects.
  function widForVideoWindow() {
    if (!videoWin) return null;
    const buf = videoWin.getNativeWindowHandle();
    // Windows/Linux x64: handle is a pointer-sized little-endian integer.
    try {
      return buf.length >= 8 ? buf.readBigUInt64LE(0).toString() : String(buf.readUInt32LE(0));
    } catch {
      return null;
    }
  }

  function ensureVideoWindow() {
    if (videoWin && !videoWin.isDestroyed()) return videoWin;
    videoWin = new BrowserWindow({
      parent: mainWindow,
      frame: false,
      show: false,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#000000',
      // No web content — this is purely an mpv render host.
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    videoWin.on('closed', () => {
      videoWin = null;
    });
    return videoWin;
  }

  // Position the video window over the stage. `rect` is in renderer CSS pixels
  // relative to the main window's content area; convert to screen coordinates.
  function placeVideoWindow(rect) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (rect) lastVideoRect = rect;
    const r = lastVideoRect;
    if (!videoWin || videoWin.isDestroyed() || !r) return;
    const content = mainWindow.getContentBounds();
    const x = Math.round(content.x + r.x);
    const y = Math.round(content.y + r.y);
    const width = Math.max(1, Math.round(r.width));
    const height = Math.max(1, Math.round(r.height));
    videoWin.setBounds({ x, y, width, height });
  }

  function hideVideoWindow() {
    if (videoWin && !videoWin.isDestroyed()) videoWin.hide();
  }

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

    // Keep the renderer's title-bar maximize/restore icon in sync, and keep the
    // embedded video aligned to the stage as the window changes.
    mainWindow.on('maximize', () => {
      mainWindow.webContents.send('window:maximized', true);
      placeVideoWindow();
    });
    mainWindow.on('unmaximize', () => {
      mainWindow.webContents.send('window:maximized', false);
      placeVideoWindow();
    });
    mainWindow.on('move', () => placeVideoWindow());
    mainWindow.on('resize', () => placeVideoWindow());
    // Hide the embedded video when the app is minimised so it doesn't linger.
    mainWindow.on('minimize', () => hideVideoWindow());
    mainWindow.on('restore', () => placeVideoWindow());

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
    // history through the existing saveProgress path. Hide the video host when
    // playback ends so the page's own placeholder shows again.
    onMpvProgress((p) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mpv:progress', p);
      }
      if (p && p.ended) hideVideoWindow();
    });

    // The on-video "Next Episode" button (drawn by mpv's Lua) asks the renderer
    // to navigate to the next episode.
    onMpvMessage((m) => {
      if (m && m.type === 'next-episode' && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('mpv:next-episode');
      }
    });

    mainWindow.on('closed', () => {
      if (videoWin && !videoWin.isDestroyed()) videoWin.destroy();
      videoWin = null;
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

  // ── Embedded video placement ──
  ipcMain.on('video:bounds', (_evt, rect) => placeVideoWindow(rect));
  ipcMain.on('video:hide', () => hideVideoWindow());

  // Renderer asks us to play a direct media URL in mpv.
  //
  // We deliberately DON'T embed mpv via --wid: the borderless child window never
  // received mouse input or showed mpv's on-screen controller, so there was no
  // seek / pause / fullscreen. Launching mpv in its OWN window (no wid → mpv.js
  // adds --fullscreen) gives the full native OSC and "just works".
  ipcMain.handle('mpv:play', async (_evt, { url, opts }) => {
    try {
      const o = opts || {};
      await playMpv(url, { ...o, wid: undefined });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  // Seek the running mpv instance (Skip Intro button).
  ipcMain.on('mpv:seek', (_evt, seconds) => seekMpv(seconds));

  // No-key streaming: torrent a magnet via the embedded WebTorrent client and
  // return a local HTTP URL the renderer hands straight to mpv (the Stremio
  // model — works without a Real-Debrid key).
  ipcMain.handle('torrent:stream', async (_evt, { magnet }) => {
    try {
      const { url } = await streamTorrent(magnet);
      return { ok: true, url };
    } catch (err) {
      return { ok: false, error: err && err.message ? err.message : String(err) };
    }
  });

  // Renderer asks us to stop mpv (leaving the page, switching away). Also stop
  // any torrent we were seeding/downloading so it doesn't run in the background.
  ipcMain.handle('mpv:stop', () => {
    stopMpv();
    hideVideoWindow();
    void stopTorrents();
    return { ok: true };
  });

  app.whenReady().then(createWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Tear down the torrent client on exit so nothing keeps downloading/seeding.
  app.on('before-quit', () => {
    void stopTorrents();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
