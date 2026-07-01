'use client';

import { Star } from 'lucide-react';
import type { AnilistMedia } from '@shared/anilist/types';
import { displayTitle, formatMeta, ratingOf } from '@/lib/format';

/**
 * The featured showcase at the top of Home. On the pinned-hero home page it
 * reflects whatever poster the D-pad is currently on (see HomeClient), so it
 * stays put while the rails scroll and updates as you move across them.
 *
 * It's display-only: no Play/Details buttons live up here. Selecting a poster
 * takes you to that title's page, which is where Play and Details live. The
 * hero just shows the name and a little context (format, genres, rating).
 */
export function Hero({ media }: { media: AnilistMedia }) {
  const title = displayTitle(media);
  const banner = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || '';
  const rating = ratingOf(media.averageScore);
  const genres = (media.genres ?? []).slice(0, 3);

  return (
    <div className="relative h-[27vh] min-h-[200px] w-full">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`banner-${media.id}`}
          src={banner}
          alt={title}
          className="tv-fade absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-base via-base/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />

      <div key={`meta-${media.id}`} className="tv-fade relative z-10 flex h-full max-w-[55%] flex-col justify-end px-[var(--tv-safe)] pb-5">
        <span className="text-[0.6rem] font-semibold uppercase tracking-[0.28em] text-accent">
          Featured
        </span>
        <h1 className="mt-1 font-heading text-[2.2rem] leading-none tracking-wide text-white">
          {title}
        </h1>
        <div className="mt-2 flex items-center gap-3 text-[0.72rem] text-zinc-300">
          {formatMeta(media) && (
            <span className="rounded bg-white/10 px-2.5 py-1">{formatMeta(media)}</span>
          )}
          {genres.map((g) => (
            <span key={g} className="rounded bg-white/10 px-2.5 py-1">
              {g}
            </span>
          ))}
          {rating && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Star className="h-4 w-4 fill-current" /> {rating}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
