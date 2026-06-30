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
 * STRICTLY the signed-in user's own key, set on their profile (BYO-key). There
 * is NO environment fallback: Real-Debrid sources only ever load when the user
 * has pasted their own key. This keeps a public, multi-user deployment honest —
 * a shared `REALDEBRID_API_KEY` violates RD's ToS and gets the account banned —
 * and means logged-out / keyless visitors get raw Torrentio sources instead of
 * silently using someone else's RD account. (To test RD locally, sign in and
 * add a key on your profile.)
 */
export async function getUserRdKey(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const db = getSupabaseService();
  if (!db) return null;
  const { data, error } = await db
    .from('user_settings')
    .select('realdebrid_key')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) return null;
  const key = (data?.realdebrid_key ?? '').trim();
  return key.length > 0 ? key : null;
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
