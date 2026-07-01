'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Loader2, MonitorPlay, Play, Zap } from 'lucide-react';
import type { StreamSource } from '@/lib/stream/sources';
import { StreamLoading } from './stream-loading';
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
  idMal?: number | null;
  durationSec?: number;
  /** Title / episode nav / advert — rendered above the source picker. */
  belowPlayer?: ReactNode;
}

interface Segment {
  start: number;
  end: number;
}
interface SkipTimes {
  op?: Segment;
  ed?: Segment;
}

/** AniSkip op/ed → mpv chapters (each START becomes a seek-bar marker). */
function buildChapters(skip: SkipTimes, durationSec?: number) {
  const marks: { t: number; title: string }[] = [{ t: 0, title: 'Episode' }];
  if (skip.op) {
    marks.push({ t: skip.op.start, title: 'Opening' });
    marks.push({ t: skip.op.end, title: 'Episode' });
  }
  if (skip.ed) {
    marks.push({ t: skip.ed.start, title: 'Ending' });
    marks.push({ t: skip.ed.end, title: 'Preview' });
  }
  if (marks.length <= 1) return [];
  marks.sort((a, b) => a.t - b.t);
  const uniq: { t: number; title: string }[] = [];
  for (const m of marks) {
    if (m.t < 0) continue;
    if (!uniq.length || Math.abs(uniq[uniq.length - 1].t - m.t) > 0.5) uniq.push(m);
  }
  const tail = durationSec && durationSec > 0 ? durationSec : uniq[uniq.length - 1].t + 600;
  return uniq.map((m, i) => ({
    start: m.t,
    end: i < uniq.length - 1 ? uniq[i + 1].t : tail,
    title: m.title,
  }));
}

/**
 * Desktop-shell watch experience — a Stremio-style source picker whose video
 * plays in **embedded mpv** (raw file, no Real-Debrid transcode → no ~0:30
 * stutter). mpv renders into a borderless child window that we keep aligned to
 * the stage below, so it feels part of the page.
 *
 * AniSkip intro/outro times become chapter markers on mpv's seek bar, and drive
 * the contextual "Skip Intro" / "Next Episode" buttons under the player.
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
  idMal,
  durationSec,
  belowPlayer,
}: Props) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);

  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [skip, setSkip] = useState<SkipTimes>({});
  // null = AniSkip not fetched yet; we wait for it before the first play so the
  // markers are present from the start.
  const [skipReady, setSkipReady] = useState(false);

  const durationRef = useRef(0);
  const failedRef = useRef<Set<number>>(new Set());
  const autoStartedRef = useRef(false);
  const playingRef = useRef(false);

  const hasNext = totalEpisodes != null && episode < totalEpisodes;

  // ── Keep the embedded video aligned to the stage ──
  const sendBounds = useCallback(() => {
    const el = stageRef.current;
    const bridge = desktop();
    if (!el || !bridge || !playingRef.current) return;
    const r = el.getBoundingClientRect();
    bridge.setVideoBounds({ x: r.left, y: r.top, width: r.width, height: r.height });
  }, []);

  useEffect(() => {
    if (activeIdx === null) return;
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(sendBounds);
    };
    schedule();
    window.addEventListener('scroll', schedule, { passive: true, capture: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    if (stageRef.current) ro.observe(stageRef.current);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', schedule, { capture: true } as never);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, [activeIdx, sendBounds]);

  // ── Persist progress + track position from mpv ──
  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    return bridge.onProgress((p) => {
      if (p.ended) {
        playingRef.current = false;
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
  }, [anilistId, episode, title, coverImage, totalEpisodes, userId]);

  // ── Fetch AniSkip times for this episode ──
  useEffect(() => {
    let cancelled = false;
    setSkip({});
    setSkipReady(false);
    if (!idMal) {
      setSkipReady(true);
      return;
    }
    fetch(`/api/skip-times/${idMal}/${episode}?len=${Math.round(durationSec ?? 0)}`)
      .then((r) => r.json())
      .then((data: SkipTimes) => {
        if (!cancelled) setSkip(data || {});
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSkipReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [idMal, episode, durationSec]);

  const playSource = useCallback(
    async (idx: number, opts: { auto?: boolean } = {}) => {
      const bridge = desktop();
      const source = sources[idx];
      if (!bridge || !source) return;

      setLoadingIdx(idx);
      setError('');
      try {
        // Two playback paths:
        //  • Real-Debrid source (has a keyless /api/direct-url) → fast HTTPS.
        //  • Magnet/infoHash source (no RD key) → torrent it via the embedded
        //    WebTorrent client and play the local stream (the Stremio model).
        let mediaUrl: string;
        if (source.magnet || source.infoHash) {
          const t = await bridge.streamTorrent(source.magnet ?? source.infoHash!);
          if (!t.ok || !t.url) {
            throw new Error(t.error || 'Could not start the torrent for this source.');
          }
          mediaUrl = t.url;
        } else {
          const res = await fetch(
            `/api/direct-url/${anilistId}/${episode}?t=${encodeURIComponent(source.title)}`,
          );
          const data = await res.json();
          if (!res.ok || !data.url) {
            throw new Error(data.error || 'Could not get a direct link for this source.');
          }
          mediaUrl = data.url;
        }

        // mpv is a separate process — subtitle URLs must be absolute.
        const origin = window.location.origin;
        const subUrls = (source.subtitles ?? []).map((s) =>
          /^https?:/i.test(s.url) ? s.url : new URL(s.url, origin).toString(),
        );

        const el = stageRef.current;
        const r = el?.getBoundingClientRect();
        const result = await bridge.playInMpv(mediaUrl, {
          title: `${title} — Episode ${episode}`,
          startAt,
          subtitles: subUrls,
          chapters: buildChapters(skip, durationSec),
          skip,
          hasNext,
          bounds: r
            ? { x: r.left, y: r.top, width: r.width, height: r.height }
            : undefined,
        });
        if (!result.ok) throw new Error(result.error || 'mpv failed to start.');
        playingRef.current = true;
        setActiveIdx(idx);
      } catch (err) {
        failedRef.current.add(idx);
        const message = err instanceof Error ? err.message : 'Playback failed.';
        if (opts.auto) {
          const next = sources.findIndex((_, i) => !failedRef.current.has(i));
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
    [anilistId, episode, sources, title, startAt, skip, durationSec, hasNext],
  );

  // Reset per-episode state when the source list changes (next episode).
  useEffect(() => {
    autoStartedRef.current = false;
    failedRef.current = new Set();
    playingRef.current = false;
    setActiveIdx(null);
    setLoadingIdx(null);
    setError('');
  }, [sources]);

  // Auto-play the best-ranked source once AniSkip has settled (so markers show
  // from the start).
  useEffect(() => {
    if (autoStartedRef.current || sources.length === 0 || !skipReady) return;
    autoStartedRef.current = true;
    void playSource(0, { auto: true });
  }, [sources, skipReady, playSource]);

  // Stop mpv + hide the embedded surface when leaving the player.
  useEffect(() => {
    const bridge = desktop();
    return () => {
      bridge?.stopMpv().catch(() => {});
      bridge?.hideVideo();
    };
  }, []);

  const goNext = useCallback(() => {
    if (hasNext) router.push(`/watch/${anilistId}/${episode + 1}`);
  }, [hasNext, router, anilistId, episode]);

  // The on-video "Next Episode" button (drawn by mpv) navigates here.
  useEffect(() => {
    const bridge = desktop();
    if (!bridge) return;
    return bridge.onNextEpisode(() => goNext());
  }, [goNext]);

  const active = activeIdx !== null ? sources[activeIdx] : null;
  const isResolving = loadingIdx !== null;

  return (
    <div className="space-y-4">
      {/* Stage — mpv renders an embedded surface over this area while playing.
          The content below shows only before playback / on error. */}
      <div className="relative">
        <div
          ref={stageRef}
          className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-glow-lg"
        >
          {coverImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverImage}
              alt={title}
              className="h-full w-full object-cover opacity-30"
            />
          )}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-base via-base/70 to-base/40 text-center">
            {isResolving ? null : active ? (
              <>
                <MonitorPlay className="h-10 w-10 text-accent" />
                <p className="text-sm font-semibold text-white">
                  Playing in the Tsumi player
                </p>
                <p className="max-w-xs px-4 text-xs text-zinc-400">
                  Smooth native playback — no transcoding. Pick another source
                  below to switch.
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

          {/* Loading hero — anime title brightens as the source opens */}
          {isResolving && (
            <StreamLoading
              title={title}
              coverImage={coverImage}
              label="Opening source in the player…"
            />
          )}
        </div>
      </div>

      {/* Title / episode nav / advert — kept above the source list so the Next
          Episode button is reachable without scrolling past every source. */}
      {belowPlayer}

      {/* Source picker (Stremio-style list) */}
      {sources.length > 0 && (
        <div>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-heading text-lg tracking-wide text-white">Sources</h2>
            <span className="text-xs text-zinc-500">{sources.length} available</span>
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
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-base/60">
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : isActive ? (
                        <Check className="h-4 w-4 text-accent" />
                      ) : (
                        <Play className="h-4 w-4 text-zinc-300" />
                      )}
                    </span>

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
