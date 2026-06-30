'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Zap, Magnet } from 'lucide-react';
import { isDesktop } from '@/lib/desktop';

/**
 * Pick where streams come from:
 *  • Real-Debrid — your own key resolves cached torrents to fast HTTPS.
 *  • Torrentio   — raw torrent/magnet sources (no key needed).
 *
 * Only rendered when the user has an RD key on their profile (otherwise it's
 * Torrentio-only and there's nothing to choose). Switching just sets the
 * `?source=` param and lets the server re-resolve.
 *
 * IMPORTANT: Torrentio (magnet) sources only PLAY in the desktop app — a browser
 * can't peer with public torrent swarms. On the website we show a hint to that
 * effect; in the desktop app they stream natively.
 */
export function SourceModeToggle({ mode }: { mode: 'rd' | 'torrent' }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => setDesktop(isDesktop()), []);

  const switchTo = (next: 'rd' | 'torrent') => {
    if (next === mode) return;
    const p = new URLSearchParams(params.toString());
    p.set('source', next);
    router.push(`${pathname}?${p.toString()}`);
  };

  const base =
    'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition';
  const on = 'bg-primary text-white shadow-glow';
  const off = 'text-zinc-400 hover:text-white';

  return (
    <div className="space-y-1.5">
      <div className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-surface/50 p-1">
        <button
          type="button"
          onClick={() => switchTo('rd')}
          className={`${base} ${mode === 'rd' ? on : off}`}
          aria-pressed={mode === 'rd'}
        >
          <Zap className="h-3.5 w-3.5" /> Real-Debrid
        </button>
        <button
          type="button"
          onClick={() => switchTo('torrent')}
          className={`${base} ${mode === 'torrent' ? on : off}`}
          aria-pressed={mode === 'torrent'}
        >
          <Magnet className="h-3.5 w-3.5" /> Torrentio
        </button>
      </div>
      {mode === 'torrent' && !desktop && (
        <p className="text-[11px] text-zinc-500">
          Torrentio sources stream in the desktop app — the browser can&apos;t
          play torrents directly.
        </p>
      )}
    </div>
  );
}
