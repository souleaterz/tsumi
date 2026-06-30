// ─────────────────────────────────────────────────────────────
// Desktop-shell bridge (client-safe).
//
// The same Next.js app serves the website AND the Electron desktop app. The
// Electron preload (electron/preload.js) injects `window.tsumiDesktop` via
// contextBridge. In the browser that object is absent, so `isDesktop()` is
// false and nothing desktop-specific renders.
//
// Why this exists: in the desktop build we play video through native **mpv**
// (raw mkv, no transcode) instead of the in-browser HLS player, which is what
// actually fixes the ~0:30 Real-Debrid transcode stutter. This module is the
// thin, type-safe wrapper the React UI calls.
// ─────────────────────────────────────────────────────────────

export interface MpvPlayOptions {
  title?: string;
  /** Resume position in seconds. */
  startAt?: number;
  /** External subtitle file URLs (.vtt/.srt) mpv should load. */
  subtitles?: string[];
}

export interface MpvProgress {
  /** Current playback position in seconds. */
  position: number;
  /** Total duration in seconds (0 until known). */
  duration: number;
  /** True once the mpv window has closed. */
  ended: boolean;
}

interface TsumiDesktopBridge {
  version: string;
  /** Launch mpv on a direct media URL. Resolves when mpv has been spawned. */
  playInMpv(url: string, opts?: MpvPlayOptions): Promise<{ ok: boolean; error?: string }>;
  /** Stop the running mpv instance (e.g. to watch in-window instead). */
  stopMpv(): Promise<{ ok: boolean }>;
  /** Subscribe to playback progress from the running mpv instance. */
  onProgress(cb: (p: MpvProgress) => void): () => void;
}

declare global {
  interface Window {
    tsumiDesktop?: TsumiDesktopBridge;
  }
}

/** True when running inside the Tsumi Electron shell. */
export function isDesktop(): boolean {
  return typeof window !== 'undefined' && Boolean(window.tsumiDesktop);
}

/** The desktop bridge, or null in the browser. */
export function desktop(): TsumiDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  return window.tsumiDesktop ?? null;
}
