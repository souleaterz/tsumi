'use client';

import { useRouter } from 'next/navigation';
import { Play, Info, Star } from 'lucide-react';
import type { AnilistMedia } from '@shared/anilist/types';
import { displayTitle, stripHtml, formatMeta, ratingOf } from '@/lib/format';
import { FocusButton } from './focus-button';

/**
 * The featured showcase at the top of Home. On the pinned-hero home page it
 * reflects whatever poster the D-pad is currently on (see HomeClient), so it
 * stays put while the rails scroll and updates as you move across them.
 */
export function Hero({ media, autoFocusPlay = true }: { media: AnilistMedia; autoFocusPlay?: boolean }) {
  const router = useRouter();
  const title = displayTitle(media);
  const banner = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || '';
  const rating = ratingOf(media.averageScore);
  const genres = (media.genres ?? []).slice(0, 3);

  return (
    <div className="relative h-[54vh] min-h-[360px] w-full">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={media.id}
          src={banner}
          alt={title}
          className="tv-fade absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-r from-base via-base/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/40 to-transparent" />

      <div key={media.id} className="tv-fade relative z-10 flex h-full max-w-[55%] flex-col justify-end px-[var(--tv-safe)] pb-8">
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.28em] text-accent">
          Featured
        </span>
        <h1 className="mt-1 font-heading text-[3.2rem] leading-none tracking-wide text-white">
          {title}
        </h1>
        <div className="mt-3 flex items-center gap-3 text-[0.75rem] text-zinc-300">
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
        <p className="mt-3 line-clamp-2 max-w-[80%] text-[0.85rem] leading-relaxed text-zinc-300">
          {stripHtml(media.description)}
        </p>
        <div className="mt-5 flex items-center gap-4">
          <FocusButton
            label="Play S1 · E1"
            Icon={Play}
            variant="primary"
            autoFocus={autoFocusPlay}
            onEnterPress={() => router.push(`/watch/${media.id}/1`)}
          />
          <FocusButton
            label="Details"
            Icon={Info}
            onEnterPress={() => router.push(`/anime/${media.id}/about`)}
          />
        </div>
      </div>
    </div>
  );
}
