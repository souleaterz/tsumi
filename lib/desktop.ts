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

/** A position rectangle in renderer CSS pixels relative to the window content. */
export interface VideoRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MpvPlayOptions {
  title?: string;
  /** Resume position in seconds. */
  startAt?: number;
  /** External subtitle file URLs (.vtt/.srt) mpv should load. */
  subtitles?: string[];
  /** Where to place the embedded video surface at launch. */
  bounds?: VideoRect;
  /** Chapters for the seek bar (AniSkip intro/outro markers). */
  chapters?: { start: number; end: number; title: string }[];
  /** AniSkip op/ed times — drive the on-video Skip Intro / Next Episode buttons. */
  skip?: { op?: { start: number; end: number }; ed?: { start: number; end: number } };
  /** Whether a next episode exists (enables the on-video Next Episode button). */
  hasNext?: boolean;
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
  /**
   * No-key streaming: torrent a magnet/infoHash through the embedded WebTorrent
   * client and get back a local HTTP URL to feed `playInMpv` — the Stremio model
   * that works with no Real-Debrid key. Returns the local URL or an error.
   */
  streamTorrent(magnet: string): Promise<{ ok: boolean; url?: string; error?: string }>;
  /** Subscribe to playback progress from the running mpv instance. */
  onProgress(cb: (p: MpvProgress) => void): () => void;

  // ── Embedded video surface ──
  /** Re-place the embedded video over the stage (CSS-pixel rect). */
  setVideoBounds(rect: VideoRect): void;
  /** Hide the embedded video surface. */
  hideVideo(): void;
  /** Seek the running mpv instance to an absolute position (seconds). */
  mpvSeek(seconds: number): void;
  /** Fires when the on-video "Next Episode" button is clicked. Returns unsubscribe. */
  onNextEpisode(cb: () => void): () => void;

  // ── Frameless window controls ──
  /** Minimise the app window. */
  minimize(): void;
  /** Toggle maximise / restore. */
  toggleMaximize(): void;
  /** Close the app window. */
  closeWindow(): void;
  /** Subscribe to maximise-state changes (for the control icon). Returns unsubscribe. */
  onMaximizeChange(cb: (isMaximized: boolean) => void): () => void;
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
