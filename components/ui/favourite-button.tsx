'use client';

import { Heart } from 'lucide-react';
import { useWatchlist } from '@/components/watchlist-provider';
import type { WatchlistItem } from '@/lib/watchlist';

/**
 * Heart toggle overlaid on a poster. Lives inside an <AnimeCard> link, so it
 * stops the click from navigating. Reads/writes the shared watchlist context.
 */
export function FavouriteButton({ item }: { item: WatchlistItem }) {
  const { isFavourite, toggle } = useWatchlist();
  const active = isFavourite(item.anilistId);

  return (
    <button
      type="button"
      aria-label={active ? 'Remove from watchlist' : 'Add to watchlist'}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      className={`flex h-7 w-7 items-center justify-center rounded-md backdrop-blur transition ${
        active
          ? 'bg-action/90 text-white shadow-[0_0_12px_rgba(220,38,38,0.5)]'
          : 'bg-base/70 text-zinc-200 hover:bg-base/90 hover:text-action'
      }`}
    >
      <Heart className={`h-4 w-4 ${active ? 'fill-current' : ''}`} />
    </button>
  );
}
