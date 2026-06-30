'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { isDesktop } from '@/lib/desktop';

/**
 * "Add your Real-Debrid key" prompt shown when the user has no key and no
 * provider is configured. It only matters on the WEBSITE: in-browser playback
 * needs Real-Debrid because browsers can't torrent public swarms (WebRTC-only).
 *
 * The desktop app streams without a key via the embedded WebTorrent client
 * (the Stremio model), so this banner is hidden there. Rendered null until
 * mounted to avoid a flash inside the desktop shell.
 */
export function NeedsKeyBanner() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || isDesktop()) return null;

  return (
    <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-zinc-200">
      <p className="font-semibold text-white">Add your Real-Debrid key to stream</p>
      <p className="mt-1 text-zinc-300">
        Streaming in your browser runs through your own Real-Debrid account. Paste
        your API key on your profile once and every episode plays over fast HTTPS —
        or{' '}
        <Link href="/" className="text-accent underline-offset-2 hover:underline">
          get the desktop app
        </Link>{' '}
        to stream with no key at all.
      </p>
      <Link
        href="/profile"
        className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary/80"
      >
        Add Real-Debrid key →
      </Link>
    </div>
  );
}
