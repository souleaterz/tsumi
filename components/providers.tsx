'use client';

import { ClerkProvider } from '@clerk/nextjs';
import type { ReactNode } from 'react';
import { SupabaseBridge } from './supabase-bridge';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Wraps the app in ClerkProvider only when Clerk keys are configured.
 * This lets Tsumi run (and the home page render with live AniList data)
 * before auth is wired up, then activates real auth once keys land in env.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!hasClerk) return <>{children}</>;

  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: '#7C3AED',
          colorBackground: '#1E1E2E',
          colorText: '#E4E4E7',
        },
      }}
    >
      <SupabaseBridge />
      {children}
    </ClerkProvider>
  );
}
