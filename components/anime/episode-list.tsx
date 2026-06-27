'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play, Check } from 'lucide-react';
import type { EpisodeMeta } from '@/lib/stream/sources';
import { getAnimeProgress, type ProgressEntry } from '@/lib/progress';
import { useUserId } from '@/lib/auth/use-user-id';

const RANGE_SIZE = 50;

export function EpisodeList({
  anilistId,
  totalEpisodes,
  meta,
  cover,
}: {
  anilistId: number;
  totalEpisodes: number;
  meta: EpisodeMeta[];
  cover?: string;
}) {
  // Per-episode watch state — drives the "watched" tick + the resume bar.
  const { userId, isLoaded } = useUserId();
  const [progress, setProgress] = useState<Map<number, ProgressEntry>>(new Map());
  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    getAnimeProgress(anilistId, userId).then((m) => {
      if (active) setProgress(m);
    });
    return () => {
      active = false;
    };
  }, [anilistId, isLoaded, userId]);

  // Use Anizip metadata when available; otherwise synthesize numeric episodes.
  const episodes = useMemo(() => {
    const count = Math.max(totalEpisodes || 0, meta.length);
    const metaByEp = new Map(meta.map((m) => [m.episode, m]));
    return Array.from({ length: count }, (_, i) => {
      const ep = i + 1;
      return metaByEp.get(ep) ?? ({ episode: ep } as EpisodeMeta);
    });
  }, [totalEpisodes, meta]);

  // Season data (TVDB via Anizip) is only usable when it covers ~all episodes —
  // some long shows (e.g. One Piece) only tag a handful, which would hide the
  // rest. Below that threshold we ignore it and use numeric ranges instead.
  const { seasons, reliableSeasons } = useMemo(() => {
    const withSeason = episodes.filter((e) => e.seasonNumber != null).length;
    const coverage = episodes.length ? withSeason / episodes.length : 0;
    const reliable = coverage >= 0.9;
    const list = reliable
      ? Array.from(
          new Set(episodes.map((e) => e.seasonNumber).filter((s): s is number => !!s)),
        ).sort((a, b) => a - b)
      : [];
    return { seasons: list, reliableSeasons: reliable };
  }, [episodes]);
  const useSeasons = seasons.length > 1;

  // Otherwise chunk long shows into 1–50 / 51–100 ranges.
  const ranges = useMemo(() => {
    const out: { label: string; start: number; end: number }[] = [];
    for (let start = 0; start < episodes.length; start += RANGE_SIZE) {
      const end = Math.min(start + RANGE_SIZE, episodes.length);
      out.push({ label: `Episodes ${start + 1}–${end}`, start, end });
    }
    return out;
  }, [episodes.length]);

  const [season, setSeason] = useState(seasons[0] ?? 1);
  const [rangeIdx, setRangeIdx] = useState(0);

  const showRanges = !useSeasons && ranges.length > 1;
  let visible = episodes;
  if (useSeasons) visible = episodes.filter((e) => e.seasonNumber === season);
  else if (showRanges) visible = episodes.slice(ranges[rangeIdx].start, ranges[rangeIdx].end);

  if (episodes.length === 0) {
    return (
      <p className="rounded-lg border border-white/5 bg-surface/40 p-6 text-sm text-zinc-500">
        No episode information available yet.
      </p>
    );
  }

  const selectClass =
    'rounded-md border border-white/10 bg-surface/60 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-primary/60 focus:shadow-glow';

  return (
    <div>
      {(useSeasons || showRanges) && (
        <div className="mb-4 flex items-center gap-2">
          {useSeasons ? (
            <select
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              className={selectClass}
            >
              {seasons.map((s) => (
                <option key={s} value={s}>
                  Season {s}
                </option>
              ))}
            </select>
          ) : (
            <select
              value={rangeIdx}
              onChange={(e) => setRangeIdx(Number(e.target.value))}
              className={selectClass}
            >
              {ranges.map((r, i) => (
                <option key={i} value={i}>
                  {r.label}
                </option>
              ))}
            </select>
          )}
          <span className="text-xs text-zinc-500">
            {visible.length} of {episodes.length} episodes
          </span>
        </div>
      )}

      <div className="grid gap-3">
        {visible.map((ep) => {
          const img = ep.image || cover;
          // Show the in-season number + season only when season data is reliable.
          const inSeason = reliableSeasons && ep.seasonNumber != null;
          const displayNum = inSeason ? ep.episodeNumber ?? ep.episode : ep.episode;
          const label = inSeason
            ? `E${displayNum} · S${ep.seasonNumber}`
            : `Episode ${displayNum}`;
          const prog = progress.get(ep.episode);
          const watched = !!prog?.completed;
          const inProgressPct =
            !watched && prog && prog.durationSec > 0
              ? Math.min(100, (prog.positionSec / prog.durationSec) * 100)
              : 0;
          return (
            <Link
              key={ep.episode}
              href={`/watch/${anilistId}/${ep.episode}`}
              className={`group flex items-center gap-4 overflow-hidden rounded-xl border p-3 transition-all hover:border-primary/40 hover:bg-surface/70 hover:shadow-glow ${
                watched
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-white/5 bg-surface/40'
              }`}
            >
              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-base sm:w-40">
                {img && (
                  <Image
                    src={img}
                    alt={label}
                    fill
                    sizes="160px"
                    className={`object-cover transition-transform duration-500 group-hover:scale-105 ${
                      watched ? 'opacity-60' : ''
                    }`}
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-base/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <Play className="h-7 w-7 fill-white text-white drop-shadow" />
                </div>
                {/* Episode number badge (top-left) */}
                <span className="absolute left-1.5 top-1.5 rounded bg-base/80 px-1.5 py-0.5 text-[10px] font-bold text-accent backdrop-blur">
                  {inSeason
                    ? `S${ep.seasonNumber}E${String(displayNum).padStart(2, '0')}`
                    : String(displayNum).padStart(2, '0')}
                </span>
                {/* Watched tick (top-right, hard to miss) */}
                {watched && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white shadow-[0_0_12px_rgba(124,58,237,0.6)] ring-2 ring-primary/40"
                    title="Watched"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[3]" />
                  </span>
                )}
                {/* In-progress bar at the bottom of the thumbnail */}
                {inProgressPct > 0 && (
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                    <div
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      style={{ width: `${inProgressPct}%` }}
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="katakana text-[8px]">{label}</p>
                <h4 className="truncate text-sm font-semibold text-zinc-100 group-hover:text-accent">
                  {ep.title || label}
                </h4>
                {ep.overview && (
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{ep.overview}</p>
                )}
                {ep.airdate && (
                  <p className="mt-1 text-[11px] text-zinc-600">{ep.airdate}</p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
