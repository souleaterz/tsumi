'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  MonitorPlay,
  Play,
  Zap,
} from 'lucide-react';
import type { StreamSource } from '@/lib/stream/sources';
import { desktop } from '@/lib/desktop';
import { saveProgress } from '@/lib/progress';

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  sources: StreamSource[];
  startAt?: number;
  userId?: string | null;
}

/**
 * Desktop-shell watch experience — a Stremio-style source picker that plays the
 * raw file in native mpv (no Real-Debrid transcode → no ~0:30 stutter).
 *
 * On mount it auto-plays the best-ranked source. The user can switch to any
 * other source from the list; mpv tears down the old playback and starts the
 * new one fullscreen. Playback position is persisted through the existing
 * saveProgress path via mpv's IPC progress events.
 *
 * Only mounted inside the Electron shell (WatchExperience branches on
 * isDesktop()), so the website is unaffected.
 */
export function DesktopWatch({
  anilistId,
  episode,
  title,
  coverImage,
  totalEpisodes,
  sources,
  startAt = 0,
  userId = null,
}: Props) {
  // Index currently playing in mpv (null = nothing yet).
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  // Index whose direct link we're currently resolving.
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [error, setError] = useState('');
  const durationRef = useRef(0);
  // Sources that failed to resolve, so auto-advance can skip them.
  const failedRef = useRef<Set<number>>(new Set());
  // Guard so the auto-play effect fires once per episode.
  const autoStartedRef = useRef(false);
  // Latest activeIdx for use inside async callbacks without stale closures.
  const activeIdxRef = useRef<number | null>(null);
  activeIdxRef.current = activeIdx;

  // Persist progress reported by mpv.
  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    return bridge.onProgress((p) => {
      if (p.ended) return;
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
  }, [anilistId, episode, title, coverImage, totalEpisodes, userId]);

  const playSource = useCallback(
    async (idx: number, opts: { auto?: boolean } = {}) => {
      const bridge = desktop();
      const source = sources[idx];
      if (!bridge || !source) return;

      setLoadingIdx(idx);
      setError('');
      try {
        const res = await fetch(
          `/api/direct-url/${anilistId}/${episode}?t=${encodeURIComponent(source.title)}`,
        );
        const data = await res.json();
        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Could not get a direct link for this source.');
        }

        // mpv is a separate process — subtitle URLs must be absolute (our sub
        // tracks come from relative /api/sub paths). Resolve against origin.
        const origin = window.location.origin;
        const subUrls = (source.subtitles ?? []).map((s) =>
          /^https?:/i.test(s.url) ? s.url : new URL(s.url, origin).toString(),
        );

        const result = await bridge.playInMpv(data.url, {
          title: `${title} — Episode ${episode}`,
          // Only resume on the first source we play; switching sources mid-watch
          // restarts that file from the saved position too, which is what we want.
          startAt,
          subtitles: subUrls,
        });
        if (!result.ok) throw new Error(result.error || 'mpv failed to start.');
        setActiveIdx(idx);
      } catch (err) {
        failedRef.current.add(idx);
        const message = err instanceof Error ? err.message : 'Playback failed.';
        // On an automatic pick, silently advance to the next untried source so
        // an evicted top source doesn't dead-end the auto-start.
        if (opts.auto) {
          const next = sources.findIndex(
            (_, i) => !failedRef.current.has(i),
          );
          if (next >= 0) {
            setLoadingIdx(null);
            void playSource(next, { auto: true });
            return;
          }
        }
        setError(message);
      } finally {
        setLoadingIdx((cur) => (cur === idx ? null : cur));
      }
    },
    [anilistId, episode, sources, title, startAt],
  );

  // Reset per-episode state when the source list changes (next episode).
  useEffect(() => {
    autoStartedRef.current = false;
    failedRef.current = new Set();
    setActiveIdx(null);
    setLoadingIdx(null);
    setError('');
  }, [sources]);

  // Auto-play the best-ranked source once per episode.
  useEffect(() => {
    if (autoStartedRef.current || sources.length === 0) return;
    autoStartedRef.current = true;
    void playSource(0, { auto: true });
  }, [sources, playSource]);

  const active = activeIdx !== null ? sources[activeIdx] : null;
  const isResolving = loadingIdx !== null;

  return (
    <div className="space-y-4">
      {/* Stage — stands in for the video (which plays in the fullscreen mpv
          window). Shows the cover with playback state. */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-glow-lg">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverImage}
            alt={title}
            className="h-full w-full object-cover opacity-30"
          />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-base via-base/70 to-base/40 text-center">
          {isResolving ? (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm text-zinc-300">Opening source in the player…</p>
            </>
          ) : active ? (
            <>
              <MonitorPlay className="h-10 w-10 text-accent" />
              <p className="text-sm font-semibold text-white">
                Playing in the Tsumi player
              </p>
              <p className="max-w-xs px-4 text-xs text-zinc-400">
                Smooth native playback — no transcoding. Pick another source below
                to switch instantly.
              </p>
            </>
          ) : error ? (
            <>
              <AlertCircle className="h-10 w-10 text-action" />
              <p className="max-w-sm px-4 text-sm text-zinc-300">{error}</p>
            </>
          ) : (
            <>
              <Play className="h-10 w-10 text-primary" />
              <p className="text-sm text-zinc-300">
                {sources.length
                  ? 'Select a source to start playing.'
                  : 'No stream sources found for this episode.'}
              </p>
            </>
          )}
          <span className="katakana text-[10px]">アプリで再生</span>
        </div>
      </div>

      {/* Source picker (Stremio-style list) */}
      {sources.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-heading text-lg tracking-wide text-white">Sources</h2>
            <span className="text-xs text-zinc-500">
              {sources.length} available
            </span>
          </div>
          <ul className="space-y-1.5">
            {sources.map((s, i) => {
              const isActive = i === activeIdx;
              const isLoading = i === loadingIdx;
              const failed = failedRef.current.has(i);
              return (
                <li key={`${s.title}-${i}`}>
                  <button
                    onClick={() => playSource(i)}
                    disabled={isLoading}
                    className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition disabled:opacity-60 ${
                      isActive
                        ? 'border-accent/60 bg-accent/10'
                        : 'border-white/10 bg-surface/40 hover:border-white/20 hover:bg-surface/70'
                    }`}
                  >
                    {/* Status / play icon */}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-base/60">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : isActive ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : (
                        <Play className="h-4 w-4 text-zinc-300" />
                      )}
                    </span>

                    {/* Quality + meta */}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-2">
                        <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[11px] font-bold uppercase text-accent">
                          {s.quality || 'SD'}
                        </span>
                        {s.cached && (
                          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-yellow-400">
                            <Zap className="h-3 w-3" /> Cached
                          </span>
                        )}
                        {s.dub && (
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-300">
                            Dub
                          </span>
                        )}
                        {failed && (
                          <span className="text-[10px] font-semibold uppercase text-action">
                            Unavailable
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 truncate text-xs text-zinc-400">
                        {s.title}
                      </span>
                    </span>

                    {/* Size / seeders */}
                    <span className="shrink-0 text-right text-[11px] text-zinc-500">
                      {s.size && <span className="block">{s.size}</span>}
                      {!s.cached && s.seeders != null && (
                        <span className="block">{s.seeders} 🌱</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
