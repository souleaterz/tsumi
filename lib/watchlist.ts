'use client';

// Signed-in users persist via server API routes (service-role, bypasses RLS);
// signed-out users fall back to localStorage. `userId` truthiness is the signal.

export interface WatchlistItem {
  anilistId: number;
  title: string;
  coverImage?: string;
  format?: string;
  addedAt: number;
}

const LS_KEY = 'tsumi:watchlist';

function readLocal(): WatchlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(items: WatchlistItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

export async function getWatchlist(userId?: string | null): Promise<WatchlistItem[]> {
  if (userId) {
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) return ((await res.json()).items ?? []) as WatchlistItem[];
    } catch {
      /* network error — fall through to empty */
    }
    return [];
  }
  return readLocal().sort((a, b) => b.addedAt - a.addedAt);
}

export async function isInWatchlist(
  anilistId: number,
  userId?: string | null,
): Promise<boolean> {
  const list = await getWatchlist(userId);
  return list.some((i) => i.anilistId === anilistId);
}

export async function addToWatchlist(item: WatchlistItem, userId?: string | null) {
  if (userId) {
    await fetch('/api/watchlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
    return;
  }
  const list = readLocal().filter((i) => i.anilistId !== item.anilistId);
  list.unshift({ ...item, addedAt: Date.now() });
  writeLocal(list);
}

export async function removeFromWatchlist(anilistId: number, userId?: string | null) {
  if (userId) {
    await fetch(`/api/watchlist?anilistId=${anilistId}`, { method: 'DELETE' });
    return;
  }
  writeLocal(readLocal().filter((i) => i.anilistId !== anilistId));
}
