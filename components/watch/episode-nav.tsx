'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SkipBack, SkipForward, List } from 'lucide-react';

export function EpisodeNav({
  anilistId,
  episode,
  totalEpisodes,
}: {
  anilistId: number;
  episode: number;
  totalEpisodes: number;
}) {
  const router = useRouter();
  const hasPrev = episode > 1;
  const count = Math.max(totalEpisodes, 1);
  const hasNext = episode < totalEpisodes;
  const all = Array.from({ length: count }, (_, i) => i + 1);

  // Group into ranges of 50 (as optgroups) so long shows don't get a giant flat list.
  const RANGE = 50;
  const grouped = count > RANGE;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={hasPrev ? `/watch/${anilistId}/${episode - 1}` : '#'}
        aria-disabled={!hasPrev}
        className={`btn-ghost px-4 py-2 text-sm ${!hasPrev ? 'pointer-events-none opacity-40' : ''}`}
      >
        <SkipBack className="h-4 w-4" /> Prev
      </Link>

      <select
        value={episode}
        onChange={(e) => router.push(`/watch/${anilistId}/${e.target.value}`)}
        className="rounded-md border border-white/10 bg-surface/60 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-primary/60"
      >
        {grouped
          ? Array.from({ length: Math.ceil(count / RANGE) }, (_, g) => {
              const start = g * RANGE + 1;
              const end = Math.min(start + RANGE - 1, count);
              return (
                <optgroup key={g} label={`Episodes ${start}–${end}`}>
                  {all.slice(start - 1, end).map((ep) => (
                    <option key={ep} value={ep}>
                      Episode {ep}
                    </option>
                  ))}
                </optgroup>
              );
            })
          : all.map((ep) => (
              <option key={ep} value={ep}>
                Episode {ep}
              </option>
            ))}
      </select>

      <Link
        href={hasNext ? `/watch/${anilistId}/${episode + 1}` : '#'}
        aria-disabled={!hasNext}
        className={`btn-ghost px-4 py-2 text-sm ${!hasNext ? 'pointer-events-none opacity-40' : ''}`}
      >
        Next <SkipForward className="h-4 w-4" />
      </Link>

      <Link href={`/anime/${anilistId}`} className="btn-ghost px-4 py-2 text-sm">
        <List className="h-4 w-4" /> All Episodes
      </Link>
    </div>
  );
}
