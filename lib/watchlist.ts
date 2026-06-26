'use client';

import { getSupabaseBrowser } from '@/lib/supabase/client';

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
  const supabase = getSupabaseBrowser();
  if (supabase && userId) {
    const { data } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });
    return (data || []).map((r) => ({
      anilistId: r.anilist_id,
      title: r.title,
      coverImage: r.cover_image,
      format: r.format,
      addedAt: new Date(r.added_at).getTime(),
    }));
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
  const supabase = getSupabaseBrowser();
  if (supabase && userId) {
    await supabase.from('watchlist').upsert(
      {
        user_id: userId,
        anilist_id: item.anilistId,
        title: item.title,
        cover_image: item.coverImage,
        format: item.format,
      },
      { onConflict: 'user_id,anilist_id' },
    );
    return;
  }
  const list = readLocal().filter((i) => i.anilistId !== item.anilistId);
  list.unshift({ ...item, addedAt: Date.now() });
  writeLocal(list);
}

export async function removeFromWatchlist(anilistId: number, userId?: string | null) {
  const supabase = getSupabaseBrowser();
  if (supabase && userId) {
    await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('anilist_id', anilistId);
    return;
  }
  writeLocal(readLocal().filter((i) => i.anilistId !== anilistId));
}
