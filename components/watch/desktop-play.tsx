'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MonitorPlay, Loader2 } from 'lucide-react';
import { isDesktop, desktop } from '@/lib/desktop';
import { saveProgress } from '@/lib/progress';

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  /** The active source's title — keys the keyless direct-link resolver. */
  sourceTitle?: string;
  startAt?: number;
  subtitles?: { url: string }[];
  userId?: string | null;
  /** Notifies the parent player when mpv playback starts/stops, so it can
   *  pause the in-window player and show a "playing in app" overlay. */
  onActiveChange?: (active: boolean) => void;
}

/**
 * Desktop-only "Play in app" button. In the Electron shell it streams the raw
 * mkv through native mpv (no Real-Debrid transcode → no ~0:30 stutter). It
 * renders nothing in a normal browser, so the website is unaffected.
 */
export function DesktopPlay({
  anilistId,
  episode,
  title,
  coverImage,
  totalEpisodes,
  sourceTitle,
  startAt = 0,
  subtitles = [],
  userId = null,
  onActiveChange,
}: Props) {
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState('');
  // Latest known duration, so we can flag "completed" from position alone.
  const durationRef = useRef(0);

  // Only mount the button inside the desktop shell.
  useEffect(() => setShow(isDesktop()), []);

  // Persist progress reported by mpv (absolute, resolves to one URL per source).
  useEffect(() => {
    if (!show) return;
    const bridge = desktop();
    if (!bridge) return;
    const off = bridge.onProgress((p) => {
      if (p.ended) {
        setState('idle');
        onActiveChange?.(false);
        return;
      }
      if (p.duration > 0) durationRef.current = p.duration;
      const dur = durationRef.current;
      if (p.position > 0 && dur > 0) {
        saveProgress(
          {
            anilistId,
            episode,
            title,
            coverImage,
            totalEpisodes,
            positionSec: p.position,
            durationSec: dur,
            completed: p.position / dur > 0.9,
            updatedAt: Date.now(),
          },
          userId,
        );
      }
    });
    return off;
  }, [show, anilistId, episode, title, coverImage, totalEpisodes, userId, onActiveChange]);

  const play = useCallback(async () => {
    if (!sourceTitle) return;
    const bridge = desktop();
    if (!bridge) return;
    setState('loading');
    setError('');
    try {
      const res = await fetch(
        `/api/direct-url/${anilistId}/${episode}?t=${encodeURIComponent(sourceTitle)}`,
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not get a direct link for this source.');
      }
      // mpv is a separate process — subtitle URLs must be absolute (our sub
      // tracks are served from relative /api/sub paths). Resolve against origin.
      const origin = window.location.origin;
      const subUrls = subtitles.map((s) =>
        /^https?:/i.test(s.url) ? s.url : new URL(s.url, origin).toString(),
      );
      const result = await bridge.playInMpv(data.url, {
        title: `${title} — Episode ${episode}`,
        startAt,
        subtitles: subUrls,
      });
      if (!result.ok) throw new Error(result.error || 'mpv failed to start.');
      setState('playing');
      onActiveChange?.(true);
    } catch (err) {
      setState('idle');
      setError(err instanceof Error ? err.message : 'Playback failed.');
    }
  }, [anilistId, episode, sourceTitle, title, startAt, subtitles, onActiveChange]);

  if (!show) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
      <button
        onClick={play}
        disabled={state === 'loading' || !sourceTitle}
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-[#0A0A0F] transition hover:bg-accent/80 disabled:opacity-50"
      >
        {state === 'loading' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <MonitorPlay className="h-4 w-4" />
        )}
        {state === 'playing' ? 'Playing in app' : 'Play in app (smooth)'}
      </button>
      <span className="text-xs text-zinc-300">
        Plays the raw file natively — no transcoding, no buffering stalls.
      </span>
      {error && <span className="w-full text-xs text-action">{error}</span>}
    </div>
  );
}
