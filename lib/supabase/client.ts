import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Module-level token getter, populated by <SupabaseBridge> when Clerk is active.
// Supabase calls it on every request so RLS can authorise rows by the Clerk
// user. Requires Clerk to be enabled as a third-party auth provider in Supabase.
let clerkTokenGetter: (() => Promise<string | null>) | null = null;

export function setSupabaseTokenGetter(getter: (() => Promise<string | null>) | null) {
  clerkTokenGetter = getter;
}

let browserClient: SupabaseClient | null = null;

/**
 * Returns a browser Supabase client, or null when Supabase isn't configured.
 * The client attaches the Clerk session token (when available) so row-level
 * security can scope reads/writes to the signed-in user.
 */
export function getSupabaseBrowser(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!browserClient) {
    browserClient = createClient(url!, anonKey!, {
      accessToken: async () => (clerkTokenGetter ? await clerkTokenGetter() : null),
    });
  }
  return browserClient;
}
