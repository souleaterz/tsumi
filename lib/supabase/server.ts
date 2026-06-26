import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let serviceClient: SupabaseClient | null = null;

/**
 * Service-role Supabase client (server-only). Bypasses RLS, so all per-user
 * reads/writes go through API routes that resolve the user from the Clerk
 * session — no dependency on the Clerk↔Supabase JWT integration. Returns null
 * when Supabase isn't configured.
 */
export function getSupabaseService(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!serviceClient) {
    serviceClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return serviceClient;
}
