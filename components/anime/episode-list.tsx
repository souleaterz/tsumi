import Link from 'next/link';
import Image from 'next/image';
import { Play } from 'lucide-react';
import type { EpisodeMeta } from '@/lib/stream/sources';

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
  // Use Anizip metadata when available; otherwise synthesize numeric episodes.
  const count = Math.max(totalEpisodes || 0, meta.length);
  const metaByEp = new Map(meta.map((m) => [m.episode, m]));
  const episodes = Array.from({ length: count }, (_, i) => {
    const ep = i + 1;
    return metaByEp.get(ep) ?? { episode: ep };
  });

  if (episodes.length === 0) {
    return (
      <p className="rounded-lg border border-white/5 bg-surface/40 p-6 text-sm text-zinc-500">
        No episode information available yet.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {episodes.map((ep) => {
        const img = ep.image || cover;
        return (
          <Link
            key={ep.episode}
            href={`/watch/${anilistId}/${ep.episode}`}
            className="group flex items-center gap-4 overflow-hidden rounded-xl border border-white/5 bg-surface/40 p-3 transition-all hover:border-primary/40 hover:bg-surface/70 hover:shadow-glow"
          >
            <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-base sm:w-40">
              {img && (
                <Image
                  src={img}
                  alt={`Episode ${ep.episode}`}
                  fill
                  sizes="160px"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-base/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Play className="h-7 w-7 fill-white text-white drop-shadow" />
              </div>
              <span className="absolute left-1.5 top-1.5 rounded bg-base/80 px-1.5 py-0.5 text-[10px] font-bold text-accent backdrop-blur">
                {String(ep.episode).padStart(2, '0')}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <p className="katakana text-[8px]">エピソード {ep.episode}</p>
              <h4 className="truncate text-sm font-semibold text-zinc-100 group-hover:text-accent">
                {ep.title || `Episode ${ep.episode}`}
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
  );
}
