'use client';

import { useEffect, useState } from 'react';
import { Plus, Check, Loader2 } from 'lucide-react';
import {
  addToWatchlist,
  isInWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '@/lib/watchlist';
import { useUserId } from '@/lib/auth/use-user-id';

export function WatchlistButton({ item }: { item: WatchlistItem }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userId, isLoaded } = useUserId();

  useEffect(() => {
    if (!isLoaded) return;
    isInWatchlist(item.anilistId, userId).then((v) => {
      setSaved(v);
      setLoading(false);
    });
  }, [item.anilistId, isLoaded, userId]);

  async function toggle() {
    setLoading(true);
    if (saved) {
      await removeFromWatchlist(item.anilistId, userId);
      setSaved(false);
    } else {
      await addToWatchlist(item, userId);
      setSaved(true);
    }
    setLoading(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={
        saved
          ? 'inline-flex items-center justify-center gap-2 rounded-md border border-primary/60 bg-primary/15 px-6 py-3 font-semibold text-accent transition hover:bg-primary/25'
          : 'btn-ghost'
      }
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : saved ? (
        <Check className="h-5 w-5" />
      ) : (
        <Plus className="h-5 w-5" />
      )}
      {saved ? 'In Watchlist' : 'Add to List'}
    </button>
  );
}
