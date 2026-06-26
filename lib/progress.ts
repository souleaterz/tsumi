'use client';

import { getSupabaseBrowser } from '@/lib/supabase/client';

export interface ProgressEntry {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: number;
}

const LS_KEY = 'tsumi:progress';

// ── localStorage fallback (used before Supabase/Clerk are wired up) ──────────
function readLocal(): ProgressEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeLocal(entries: ProgressEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LS_KEY, JSON.stringify(entries.slice(0, 50)));
}

/** Save (upsert) progress for a single episode. */
export async function saveProgress(entry: ProgressEntry, userId?: string | null) {
  const supabase = getSupabaseBrowser();

  if (supabase && userId) {
    await supabase.from('watch_progress').upsert(
      {
        user_id: userId,
        anilist_id: entry.anilistId,
        episode: entry.episode,
        title: entry.title,
        cover_image: entry.coverImage,
        total_episodes: entry.totalEpisodes,
        position_sec: entry.positionSec,
        duration_sec: entry.durationSec,
        completed: entry.completed,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,anilist_id,episode' },
    );
    return;
  }

  // Local fallback: keep only the latest entry per (anime, episode).
  const all = readLocal().filter(
    (e) => !(e.anilistId === entry.anilistId && e.episode === entry.episode),
  );
  all.unshift({ ...entry, updatedAt: Date.now() });
  writeLocal(all);
}

/** Latest in-progress episode per anime, newest first — drives Continue Watching. */
export async function getContinueWatching(
  userId?: string | null,
  limit = 12,
): Promise<ProgressEntry[]> {
  const supabase = getSupabaseBrowser();

  if (supabase && userId) {
    const { data } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('completed', false)
      .order('updated_at', { ascending: false })
      .limit(limit);
    return (data || []).map(rowToEntry);
  }

  // Local fallback — dedupe to latest episode per anime.
  const seen = new Set<number>();
  return readLocal()
    .filter((e) => !e.completed)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((e) => (seen.has(e.anilistId) ? false : seen.add(e.anilistId)))
    .slice(0, limit);
}

export async function getEpisodeProgress(
  anilistId: number,
  episode: number,
  userId?: string | null,
): Promise<ProgressEntry | null> {
  const supabase = getSupabaseBrowser();
  if (supabase && userId) {
    const { data } = await supabase
      .from('watch_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('anilist_id', anilistId)
      .eq('episode', episode)
      .maybeSingle();
    return data ? rowToEntry(data) : null;
  }
  return (
    readLocal().find((e) => e.anilistId === anilistId && e.episode === episode) || null
  );
}

function rowToEntry(row: any): ProgressEntry {
  return {
    anilistId: row.anilist_id,
    episode: row.episode,
    title: row.title,
    coverImage: row.cover_image,
    totalEpisodes: row.total_episodes,
    positionSec: row.position_sec,
    durationSec: row.duration_sec,
    completed: row.completed,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}
