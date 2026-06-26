import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side Pro status lookup.
 *
 * Reads the `subscriptions` table (mirrored from Stripe webhooks) with the
 * service-role key so it bypasses RLS and can't be spoofed from the client.
 * Returns false whenever Supabase isn't configured or the user isn't Pro —
 * so free-tier behaviour (ads, 720p cap) is always the safe default.
 */
export async function getProStatus(userId: string | null): Promise<boolean> {
  if (!userId) return false;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return false;

  try {
    const supabase = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const { data } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .maybeSingle();

    return data?.tier === 'pro' && data?.status === 'active';
  } catch {
    return false;
  }
}

/** Resolves the current request's Clerk user id (server-side), or null. */
export async function currentUserId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return null;
  try {
    const { auth } = await import('@clerk/nextjs/server');
    return auth().userId ?? null;
  } catch {
    return null;
  }
}
