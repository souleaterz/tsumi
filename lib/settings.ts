import 'server-only';
import { getSupabaseService } from './supabase/server';

// ─────────────────────────────────────────────────────────────
// Per-user settings — currently just the user's own Real-Debrid API key.
//
// BYO-key model: Tsumi no longer ships a single shared Real-Debrid key (that
// gets the account banned the moment the app is public). Each signed-in user
// pastes their own key on their profile; it's stored server-side via the
// service-role client and threaded into the streaming pipeline per request.
// The key value is never sent back to the browser — the API only reports
// whether one is set, plus a masked hint.
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the Real-Debrid key to use for this request.
 *
 * 1. The signed-in user's own stored key (the public, BYO-key path).
 * 2. Self-host fallback: a single `REALDEBRID_API_KEY` in the environment.
 *
 * The fallback is OFF unless that env var is set. It exists for a PERSONAL /
 * self-hosted copy (one operator, one key, no sign-in needed to test). Do NOT
 * set it on a public multi-user deployment — a shared key violates RD's ToS and
 * gets banned. There, leave it unset so every user supplies their own.
 */
export async function getUserRdKey(userId: string | null): Promise<string | null> {
  if (userId) {
    const db = getSupabaseService();
    if (db) {
      const { data, error } = await db
        .from('user_settings')
        .select('realdebrid_key')
        .eq('user_id', userId)
        .maybeSingle();
      if (!error) {
        const key = (data?.realdebrid_key ?? '').trim();
        if (key.length > 0) return key;
      }
    }
  }
  // Self-host / local-testing fallback.
  const envKey = (process.env.REALDEBRID_API_KEY ?? '').trim();
  return envKey.length > 0 ? envKey : null;
}

/** Set (or clear, when key is null/empty) the user's Real-Debrid key. */
export async function setUserRdKey(
  userId: string,
  key: string | null,
): Promise<boolean> {
  const db = getSupabaseService();
  if (!db) return false;
  const value = key && key.trim().length > 0 ? key.trim() : null;
  const { error } = await db.from('user_settings').upsert(
    { user_id: userId, realdebrid_key: value, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' },
  );
  return !error;
}

/** A short, safe hint of a key for the UI: last 4 chars only. */
export function maskKey(key: string): string {
  const tail = key.slice(-4);
  return tail ? `••••${tail}` : '••••';
}
