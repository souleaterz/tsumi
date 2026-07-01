'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Loader2, Check, Zap, AlertCircle, MonitorPlay } from 'lucide-react';
import { clsx } from 'clsx';
import type { StreamSource } from '@shared/stream/sources';
import { isTV, tv } from '@/lib/tv-native';
import { getRdKey } from '@/lib/rdkey';
import { saveProgress, getEpisodeProgress, isCompleted } from '@/lib/progress';
import { Focusable, FocusSection } from './focusable';

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  idMal?: number | null;
  durationSec?: number;
}

type Mode = 'torrent' | 'rd';

/**
 * Fire TV watch experience — a Stremio-style source picker with source-mode tabs
 * (Torrentio always; Real-Debrid only when a key is installed) and a horizontally
 * scrollable row of source cards. Selecting a source plays it natively through
 * the shell (torrent client → libVLC, or a Real-Debrid direct link), mirroring
 * the desktop app's flow but talking to window.tsumiTV.
 *
 * In a plain browser (development) there's no native bridge, so it just marks the
 * chosen source and notes that playback happens in the Fire TV app.
 */
export function WatchTV({ anilistId, episode, title, coverImage, totalEpisodes }: Props) {
  const router = useRouter();
  // Read the RD key once — a key present means the Real-Debrid tab shows and is
  // the default (its cached links are the smoothest path).
  const rdKey = typeof window !== 'undefined' ? getRdKey() : '';
  const hasRdKey = Boolean(rdKey);
  const [mode, setMode] = useState<Mode>(hasRdKey ? 'rd' : 'torrent');
  const [sources, setSources] = useState<StreamSource[] | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  const [error, setError] = useState('');
  const failedRef = useRef<Set<number>>(new Set());

  const native = isTV();
  const hasNext = totalEpisodes != null && episode < totalEpisodes;

  // Resume position for this episode (from the local progress store).
  const resume = typeof window !== 'undefined' ? getEpisodeProgress(anilistId, episode) : null;
  const startAt = resume && !isCompleted(resume) ? resume.positionSec : 0;

  const recordProgress = useCallback(
    (positionSec: number, durationSec: number) => {
      saveProgress({
        id: anilistId,
        ep: episode,
        title,
        cover: coverImage,
        positionSec,
        durationSec,
        totalEpisodes,
        updatedAt: Date.now(),
      });
    },
    [anilistId, episode, title, coverImage, totalEpisodes],
  );

  // Persist real playback position from the native player as it plays.
  useEffect(() => {
    const bridge = tv();
    if (!bridge) return;
    return bridge.onProgress((p) => {
      if (p.ended) return;
      if (p.position > 0 && p.duration > 0) recordProgress(p.position, p.duration);
    });
  }, [recordProgress]);

  // Fetch sources for this episode + mode.
  useEffect(() => {
    let cancelled = false;
    setSources(null);
    setError('');
    setActiveIdx(null);
    failedRef.current = new Set();
    const rd = mode === 'rd' && rdKey ? `&rdkey=${encodeURIComponent(rdKey)}` : '';
    fetch(`/api/streams?id=${anilistId}&ep=${episode}&t=${encodeURIComponent(title)}&source=${mode}${rd}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSources(data.sources ?? []);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });
    return () => {
      cancelled = true;
    };
  }, [anilistId, episode, title, mode]);

  const playSource = useCallback(
    async (idx: number, opts: { auto?: boolean } = {}) => {
      const list = sources ?? [];
      const source = list[idx];
      if (!source) return;
      const bridge = tv();

      if (!bridge) {
        // Browser/dev: no native player — still mark it started so it shows up
        // in Continue watching (real positions come from the shell).
        recordProgress(startAt, resume?.durationSec ?? 0);
        setActiveIdx(idx);
        return;
      }

      setLoadingIdx(idx);
      setError('');
      try {
        let mediaUrl: string;
        if (source.magnet || source.infoHash) {
          const t = await bridge.streamTorrent(source.magnet ?? source.infoHash!);
          if (!t.ok || !t.url) throw new Error(t.error || 'Could not start this source.');
          mediaUrl = t.url;
        } else {
          const rd = rdKey ? `&rdkey=${encodeURIComponent(rdKey)}` : '';
          const res = await fetch(`/api/direct-url/${anilistId}/${episode}?t=${encodeURIComponent(source.title)}${rd}`);
          const data = await res.json();
          if (!res.ok || !data.url) throw new Error(data.error || 'Could not get a direct link.');
          mediaUrl = data.url;
        }
        const origin = window.location.origin;
        const subUrls = (source.subtitles ?? []).map((s) =>
          /^https?:/i.test(s.url) ? s.url : new URL(s.url, origin).toString(),
        );
        const result = await bridge.play(mediaUrl, { title: `${title} — Episode ${episode}`, startAt, subtitles: subUrls, hasNext });
        if (!result.ok) throw new Error(result.error || 'The player failed to start.');
        recordProgress(startAt, resume?.durationSec ?? 0);
        setActiveIdx(idx);
      } catch (err) {
        failedRef.current.add(idx);
        const message = err instanceof Error ? err.message : 'Playback failed.';
        if (opts.auto) {
          const next = list.findIndex((_, i) => !failedRef.current.has(i));
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
    [sources, anilistId, episode, title, hasNext, rdKey, startAt, recordProgress, resume?.durationSec],
  );

  const loading = sources === null;
  const tabs: { key: Mode; label: string }[] = [
    { key: 'torrent', label: 'Torrentio' },
    ...(hasRdKey ? [{ key: 'rd' as Mode, label: 'Real-Debrid' }] : []),
  ];

  return (
    <div className="px-[var(--tv-safe)] pb-16 pt-8">
      {/* Stage */}
      <div className="relative mb-5 aspect-[21/9] w-full overflow-hidden rounded-2xl border border-white/10 bg-black">
        {coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImage} alt={title} className="h-full w-full object-cover opacity-30" />
        )}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-t from-base via-base/70 to-base/40 text-center">
          {error ? (
            <>
              <AlertCircle className="h-10 w-10 text-action" />
              <p className="max-w-md text-[0.9rem] text-zinc-300">{error}</p>
            </>
          ) : activeIdx !== null ? (
            <>
              <MonitorPlay className="h-10 w-10 text-accent" />
              <p className="text-[0.95rem] font-medium text-white">
                {native ? 'Playing in the Tsumi player' : 'Selected — playback runs in the Fire TV app'}
              </p>
            </>
          ) : (
            <>
              <Play className="h-10 w-10 text-primary" />
              <p className="text-[0.9rem] text-zinc-300">
                {loading ? 'Finding sources…' : sources?.length ? 'Choose a source below' : 'No sources found for this episode.'}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="font-heading text-[1.6rem] tracking-wide text-white">
          {title} <span className="text-zinc-500">· E{episode}</span>
        </h2>
        {sources && <span className="text-[0.75rem] text-zinc-500">{sources.length} sources</span>}
      </div>

      {/* Source-mode tabs */}
      <FocusSection className="mb-4 flex gap-2">
        {tabs.map((t) => (
          <Focusable
            key={t.key}
            ariaLabel={t.label}
            autoFocus={t.key === mode}
            onEnterPress={() => setMode(t.key)}
          >
            {(focused) => (
              <div
                className={clsx(
                  'rounded-xl px-5 py-2.5 text-[0.82rem] font-medium transition-colors',
                  t.key === mode ? 'bg-primary text-white' : focused ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300',
                )}
              >
                {t.label}
              </div>
            )}
          </Focusable>
        ))}
      </FocusSection>

      {/* Sources — horizontally scrollable cards */}
      {loading ? (
        <div className="flex items-center gap-2 py-8 text-zinc-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading sources…
        </div>
      ) : (
        <FocusSection className="flex gap-3 overflow-x-auto pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(sources ?? []).map((s, i) => {
            const isActive = i === activeIdx;
            const isLoading = i === loadingIdx;
            const failed = failedRef.current.has(i);
            return (
              <Focusable
                key={`${s.title}-${i}`}
                bare
                scrollOnFocus
                autoFocus={i === 0}
                ariaLabel={s.title}
                onEnterPress={() => playSource(i)}
                className="w-[20vw] min-w-[240px] shrink-0"
              >
                {(focused) => (
                  <div
                    className={clsx(
                      'flex h-full flex-col gap-2 rounded-xl border p-3.5 transition-colors',
                      isActive
                        ? 'border-accent/60 bg-accent/10'
                        : focused
                          ? 'border-transparent bg-surface/80 outline outline-[3px] outline-white [outline-offset:3px]'
                          : 'border-white/10 bg-surface/40',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[0.65rem] font-bold uppercase text-accent">
                        {s.quality || 'SD'}
                      </span>
                      {s.cached && (
                        <span className="inline-flex items-center gap-0.5 text-[0.65rem] font-semibold text-yellow-400">
                          <Zap className="h-3 w-3" /> Cached
                        </span>
                      )}
                      {s.dub && (
                        <span className="rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase text-zinc-300">Dub</span>
                      )}
                      <span className="ml-auto">
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        ) : isActive ? (
                          <Check className="h-4 w-4 text-accent" />
                        ) : (
                          <Play className="h-4 w-4 text-zinc-400" />
                        )}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-[0.72rem] leading-snug text-zinc-300">{s.title}</p>
                    <div className="mt-auto flex items-center gap-3 text-[0.65rem] text-zinc-500">
                      {s.size && <span>{s.size}</span>}
                      {!s.cached && s.seeders != null && <span>{s.seeders} 🌱</span>}
                      {failed && <span className="font-semibold uppercase text-action">Unavailable</span>}
                    </div>
                  </div>
                )}
              </Focusable>
            );
          })}
        </FocusSection>
      )}

      {hasNext && (
        <div className="mt-6">
          <Focusable ariaLabel="Next episode" onEnterPress={() => router.push(`/watch/${anilistId}/${episode + 1}`)}>
            {(focused) => (
              <div className={clsx('inline-flex rounded-xl px-6 py-3 text-[0.85rem] font-medium', focused ? 'bg-white text-base' : 'bg-white/10 text-zinc-200')}>
                Next episode →
              </div>
            )}
          </Focusable>
        </div>
      )}
    </div>
  );
}
