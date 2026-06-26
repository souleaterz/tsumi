'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <span className="font-jp text-6xl text-action/40">罪</span>
      <h1 className="mt-4 font-heading text-5xl tracking-wider text-white">
        Something Broke
      </h1>
      <p className="katakana mt-1 text-xs">エラーが発生しました</p>
      <p className="mt-4 max-w-md text-sm text-zinc-400">
        We couldn’t load this content. AniList may be rate-limiting — try again in a moment.
      </p>
      <div className="mt-6 flex gap-3">
        <button onClick={reset} className="btn-cta">
          Try Again
        </button>
        <Link href="/" className="btn-ghost">
          Go Home
        </Link>
      </div>
    </div>
  );
}
