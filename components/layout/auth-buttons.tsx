'use client';

import Link from 'next/link';
import { SignedIn, SignedOut, UserButton, SignInButton } from '@clerk/nextjs';

/** Real Clerk auth controls — only mounted when Clerk keys are present. */
export function ClerkAuthButtons() {
  return (
    <>
      <SignedOut>
        <SignInButton mode="modal">
          <button className="text-sm font-medium text-zinc-300 transition-colors hover:text-accent">
            Sign in
          </button>
        </SignInButton>
        <Link
          href="/profile"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-primary/90"
        >
          Get Started
        </Link>
      </SignedOut>
      <SignedIn>
        <Link
          href="/profile"
          className="text-sm font-medium text-zinc-300 transition-colors hover:text-accent"
        >
          Profile
        </Link>
        <UserButton
          afterSignOutUrl="/"
          appearance={{ elements: { avatarBox: 'w-9 h-9 ring-2 ring-primary/50' } }}
        />
      </SignedIn>
    </>
  );
}
