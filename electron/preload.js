// Preload — the ONLY bridge between the website and the native shell.
// Exposes a minimal, typed surface as window.tsumiDesktop (see lib/desktop.ts).
// contextIsolation is on, so the renderer can't reach Node/Electron directly.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tsumiDesktop', {
  version: process.env.npm_package_version || '0.1.0',

  // Launch mpv on a direct media URL. Returns { ok, error? }.
  playInMpv: (url, opts) => ipcRenderer.invoke('mpv:play', { url, opts }),

  // Stop the running mpv instance.
  stopMpv: () => ipcRenderer.invoke('mpv:stop'),

  // Subscribe to playback progress events from the running mpv instance.
  // Returns an unsubscribe function.
  onProgress: (cb) => {
    const handler = (_evt, p) => cb(p);
    ipcRenderer.on('mpv:progress', handler);
    return () => ipcRenderer.removeListener('mpv:progress', handler);
  },

  // ── Frameless window controls (our React title bar calls these) ──
  minimize: () => ipcRenderer.send('window:minimize'),
  toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),
  // Notifies when the OS maximize state changes (icon swap). Returns unsubscribe.
  onMaximizeChange: (cb) => {
    const handler = (_evt, isMax) => cb(isMax);
    ipcRenderer.on('window:maximized', handler);
    return () => ipcRenderer.removeListener('window:maximized', handler);
  },
});
