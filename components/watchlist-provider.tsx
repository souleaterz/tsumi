'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  addToWatchlist,
  getWatchlist,
  removeFromWatchlist,
  type WatchlistItem,
} from '@/lib/watchlist';
import { useUserId } from '@/lib/auth/use-user-id';

interface WatchlistContextValue {
  ids: Set<number>;
  isFavourite: (anilistId: number) => boolean;
  toggle: (item: WatchlistItem) => Promise<void>;
  ready: boolean;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

/**
 * Loads the user's watchlist once and shares it, so a grid of favourite hearts
 * doesn't fire one request per card. Toggles optimistically, then persists.
 */
export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { userId, isLoaded } = useUserId();
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    getWatchlist(userId).then((list) => {
      if (!active) return;
      setIds(new Set(list.map((i) => i.anilistId)));
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  const toggle = useCallback(
    async (item: WatchlistItem) => {
      const has = ids.has(item.anilistId);
      // Optimistic update.
      setIds((prev) => {
        const next = new Set(prev);
        has ? next.delete(item.anilistId) : next.add(item.anilistId);
        return next;
      });
      try {
        if (has) await removeFromWatchlist(item.anilistId, userId);
        else await addToWatchlist(item, userId);
      } catch {
        // Roll back on failure.
        setIds((prev) => {
          const next = new Set(prev);
          has ? next.add(item.anilistId) : next.delete(item.anilistId);
          return next;
        });
      }
    },
    [ids, userId],
  );

  const isFavourite = useCallback((anilistId: number) => ids.has(anilistId), [ids]);

  return (
    <WatchlistContext.Provider value={{ ids, isFavourite, toggle, ready }}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used within WatchlistProvider');
  return ctx;
}
