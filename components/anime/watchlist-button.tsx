'use client';

import { Plus, Check } from 'lucide-react';
import { useWatchlist } from '@/components/watchlist-provider';
import type { WatchlistItem } from '@/lib/watchlist';

export function WatchlistButton({ item }: { item: WatchlistItem }) {
  const { isFavourite, toggle } = useWatchlist();
  const saved = isFavourite(item.anilistId);

  return (
    <button
      onClick={() => toggle(item)}
      className={
        saved
          ? 'inline-flex items-center justify-center gap-2 rounded-md border border-primary/60 bg-primary/15 px-6 py-3 font-semibold text-accent transition hover:bg-primary/25'
          : 'btn-ghost'
      }
    >
      {saved ? <Check className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
      {saved ? 'In Watchlist' : 'Add to List'}
    </button>
  );
}
