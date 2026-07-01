// ─────────────────────────────────────────────────────────────
// Fire TV native-shell bridge (client-safe).
//
// The same TV web app runs in a normal browser (for development) AND inside the
// Android TV WebView shell. The shell injects `window.tsumiTV` (an Android
// JavascriptInterface, wrapped Promise-style). In the browser that object is
// absent, so `isTV()` is false and the watch page uses its browser fallback.
//
// This mirrors the desktop app's lib/desktop.ts bridge one-to-one: keyless
// torrent streaming + a native player (libVLC there, mpv on desktop).
// ─────────────────────────────────────────────────────────────

export interface TvPlayOptions {
  title?: string;
  /** Resume position in seconds. */
  startAt?: number;
  /** External subtitle file URLs (.vtt/.srt) the player should load. */
  subtitles?: string[];
  /** AniSkip op/ed times — drive the on-video Skip Intro / Next Episode UI. */
  skip?: { op?: { start: number; end: number }; ed?: { start: number; end: number } };
  /** Whether a next episode exists (enables the Next Episode button). */
  hasNext?: boolean;
  /** Prefer the English dub audio track when the file is dual-audio. */
  preferDub?: boolean;
}

export interface TvProgress {
  position: number;
  duration: number;
  ended: boolean;
}

export interface TsumiTvBridge {
  version: string;
  /** Torrent a magnet/infoHash through the native client → local HTTP URL. */
  streamTorrent(magnet: string): Promise<{ ok: boolean; url?: string; error?: string }>;
  /** Launch the native player on a direct media URL. */
  play(url: string, opts?: TvPlayOptions): Promise<{ ok: boolean; error?: string }>;
  /** Stop the native player. */
  stop(): Promise<{ ok: boolean }>;
  /** Subscribe to playback progress from the native player. */
  onProgress(cb: (p: TvProgress) => void): () => void;
  /** Fires when the on-video "Next Episode" button is pressed. */
  onNextEpisode(cb: () => void): () => void;
}

/**
 * The RAW Android JavascriptInterface the shell injects (see android-tv/…/
 * MainActivity.kt). Its methods are synchronous and string-only; we wrap them
 * into the Promise-based TsumiTvBridge below. Android injects this object before
 * page scripts run, so there's no load-order race — we build the bridge lazily
 * the first time tv() is called.
 */
interface TsumiNativeRaw {
  version?(): string;
  streamTorrent(reqId: number, magnet: string): void;
  play(reqId: number, optsJson: string): void;
  stop(reqId: number): void;
}

declare global {
  interface Window {
    tsumiTV?: TsumiTvBridge;
    TsumiNative?: TsumiNativeRaw;
    // Native → web callbacks (invoked via WebView.evaluateJavascript).
    __tsumiResolve?: (reqId: number, json: string) => void;
    __tsumiEmitProgress?: (json: string) => void;
    __tsumiEmitNext?: () => void;
  }
}

/** Wrap the raw sync interface into the async bridge the UI expects. */
function buildBridge(raw: TsumiNativeRaw): TsumiTvBridge {
  let seq = 0;
  const pending = new Map<number, (v: unknown) => void>();
  const progressCbs = new Set<(p: TvProgress) => void>();
  const nextCbs = new Set<() => void>();

  window.__tsumiResolve = (reqId, json) => {
    const resolve = pending.get(reqId);
    if (!resolve) return;
    pending.delete(reqId);
    try {
      resolve(JSON.parse(json));
    } catch {
      resolve({ ok: false, error: 'Bad response from player.' });
    }
  };
  window.__tsumiEmitProgress = (json) => {
    let p: TvProgress;
    try {
      p = JSON.parse(json);
    } catch {
      return;
    }
    progressCbs.forEach((cb) => cb(p));
  };
  window.__tsumiEmitNext = () => nextCbs.forEach((cb) => cb());

  const call = <T>(fn: (id: number) => void): Promise<T> =>
    new Promise<T>((resolve) => {
      const id = ++seq;
      pending.set(id, resolve as (v: unknown) => void);
      fn(id);
    });

  return {
    version: raw.version?.() ?? '0.1.0',
    streamTorrent: (magnet) => call((id) => raw.streamTorrent(id, magnet)),
    play: (url, opts) => call((id) => raw.play(id, JSON.stringify({ url, opts: opts ?? {} }))),
    stop: () => call((id) => raw.stop(id)),
    onProgress: (cb) => {
      progressCbs.add(cb);
      return () => progressCbs.delete(cb);
    },
    onNextEpisode: (cb) => {
      nextCbs.add(cb);
      return () => nextCbs.delete(cb);
    },
  };
}

/** The native TV bridge, or null in a plain browser. Built once, then cached. */
export function tv(): TsumiTvBridge | null {
  if (typeof window === 'undefined') return null;
  if (window.tsumiTV) return window.tsumiTV;
  if (window.TsumiNative) {
    window.tsumiTV = buildBridge(window.TsumiNative);
    return window.tsumiTV;
  }
  return null;
}

/** True when running inside the Tsumi Fire TV shell. */
export function isTV(): boolean {
  return tv() !== null;
}
