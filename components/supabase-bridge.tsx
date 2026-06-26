'use client';

import { useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { setSupabaseTokenGetter } from '@/lib/supabase/client';

/**
 * Feeds the Clerk session token into the Supabase client so RLS policies can
 * authorise rows by the signed-in user. Only mounted when Clerk is configured
 * (see Providers). Pair with Clerk's native Supabase third-party auth setup.
 */
export function SupabaseBridge() {
  const { getToken, isSignedIn } = useAuth();

  useEffect(() => {
    setSupabaseTokenGetter(async () => {
      try {
        return isSignedIn ? await getToken() : null;
      } catch {
        return null;
      }
    });
    return () => setSupabaseTokenGetter(null);
  }, [getToken, isSignedIn]);

  return null;
}
