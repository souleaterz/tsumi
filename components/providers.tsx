'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import type { ReactNode } from 'react';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/** Shared dark Clerk appearance so auth UI matches the Tsumi theme. */
export const clerkAppearance = {
  baseTheme: dark,
  variables: {
    colorPrimary: '#7C3AED',
    colorBackground: '#1E1E2E',
    colorText: '#E4E4E7',
    colorInputBackground: '#15151f',
    colorInputText: '#E4E4E7',
  },
  elements: {
    card: 'bg-surface border border-white/10',
    headerTitle: 'text-white',
    socialButtonsBlockButton: 'border border-white/10',
  },
};

/**
 * Wraps the app in ClerkProvider only when Clerk keys are configured.
 * This lets Tsumi run (and the home page render with live AniList data)
 * before auth is wired up, then activates real auth once keys land in env.
 */
export function Providers({ children }: { children: ReactNode }) {
  if (!hasClerk) return <>{children}</>;

  return <ClerkProvider appearance={clerkAppearance}>{children}</ClerkProvider>;
}
