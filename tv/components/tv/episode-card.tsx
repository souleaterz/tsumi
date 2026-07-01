'use client';

import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { clsx } from 'clsx';
import type { EpisodeMeta } from '@shared/stream/sources';
import { Focusable } from './focusable';

interface Props {
  anilistId: number;
  ep: EpisodeMeta;
  season: number;
  coverFallback?: string;
  autoFocus?: boolean;
}

/** A wide (16:9) episode card for the horizontally-scrolling episode rail. */
export function EpisodeCard({ anilistId, ep, season, coverFallback, autoFocus }: Props) {
  const router = useRouter();
  const label = `S${season} · E${ep.episodeNumber ?? ep.episode}`;
  const thumb = ep.image || coverFallback;

  return (
    <Focusable
      bare
      scrollOnFocus
      autoFocus={autoFocus}
      ariaLabel={`${label} ${ep.title ?? ''}`.trim()}
      onEnterPress={() => router.push(`/watch/${anilistId}/${ep.episode}`)}
      className="w-[19vw] min-w-[260px] shrink-0"
    >
      {(focused) => (
        <div>
          <div
            className={clsx(
              'relative aspect-video w-full overflow-hidden rounded-xl border bg-surface',
              focused ? 'border-transparent outline outline-[3px] outline-white [outline-offset:4px]' : 'border-white/10',
            )}
          >
            {thumb && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumb} alt={label} loading="lazy" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
            <span className="absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[0.65rem] font-semibold text-white">
              {label}
            </span>
            {focused && (
              <span className="absolute inset-0 flex items-center justify-center">
                <Play className="h-9 w-9 text-white drop-shadow" />
              </span>
            )}
          </div>
          <p className={clsx('mt-2 line-clamp-1 text-[0.8rem]', focused ? 'text-white' : 'text-zinc-300')}>
            {ep.title || `Episode ${ep.episodeNumber ?? ep.episode}`}
          </p>
        </div>
      )}
    </Focusable>
  );
}
