'use client';

import Link from 'next/link';
import { SignIn, SignUp } from '@clerk/nextjs';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

/**
 * Renders the Clerk SignIn/SignUp widget when configured. Without Clerk keys
 * it shows a friendly notice instead of crashing — auth is optional until
 * keys are added to the environment.
 */
export function AuthPanel({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  if (!hasClerk) {
    return (
      <div className="glass max-w-md rounded-xl p-6 text-center">
        <p className="text-sm text-zinc-300">
          Authentication isn’t configured yet.
        </p>
        <p className="mt-2 text-xs text-zinc-500">
          Add your Clerk keys to <code className="text-accent">.env.local</code> to
          enable sign in. You can still browse and track anime locally in the meantime.
        </p>
        <Link href="/profile" className="btn-ghost mt-4 text-sm">
          Continue to Profile
        </Link>
      </div>
    );
  }

  return mode === 'sign-in' ? (
    <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/profile" />
  ) : (
    <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/profile" />
  );
}
