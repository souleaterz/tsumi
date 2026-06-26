'use client';

import { useAuth } from '@clerk/nextjs';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Returns the current Clerk user id (or null) plus whether auth has resolved.
 *
 * `hasClerk` is a compile-time constant inlined at build, so the hook call
 * order is stable across renders — when Clerk isn't configured we never touch
 * its hooks and report an immediate, signed-out `{ userId: null }`. Components
 * use this to decide between Supabase (signed in) and the localStorage fallback.
 */
export function useUserId(): { userId: string | null; isLoaded: boolean } {
  if (!hasClerk) {
    return { userId: null, isLoaded: true };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { userId, isLoaded } = useAuth();
  return { userId: userId ?? null, isLoaded };
}
