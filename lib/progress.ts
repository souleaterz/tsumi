'use client';

// Signed-in users persist via server API routes (service-role, bypasses RLS);
// signed-out users fall back to localStorage. `userId` truthiness is the signal.

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
  if (userId) {
    await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
      keepalive: true, // let the save land even if the page is unloading
    });
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
  includeCompleted = false,
): Promise<ProgressEntry[]> {
  if (userId) {
    try {
      const all = includeCompleted ? '&all=1' : '';
      const res = await fetch(`/api/progress?limit=${limit}${all}`);
      if (res.ok) return ((await res.json()).items ?? []) as ProgressEntry[];
    } catch {
      /* network error — fall through to empty */
    }
    return [];
  }

  // Local fallback — dedupe to latest episode per anime.
  const seen = new Set<number>();
  return readLocal()
    .filter((e) => includeCompleted || !e.completed)
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((e) => (seen.has(e.anilistId) ? false : seen.add(e.anilistId)))
    .slice(0, limit);
}

export async function getEpisodeProgress(
  anilistId: number,
  episode: number,
  userId?: string | null,
): Promise<ProgressEntry | null> {
  if (userId) {
    try {
      const res = await fetch(`/api/progress?anilistId=${anilistId}&episode=${episode}`);
      if (res.ok) return ((await res.json()).entry ?? null) as ProgressEntry | null;
    } catch {
      /* network error */
    }
    return null;
  }
  return (
    readLocal().find((e) => e.anilistId === anilistId && e.episode === episode) || null
  );
}
