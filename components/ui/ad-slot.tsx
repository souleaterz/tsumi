'use client';

import { useEffect, useRef, useState } from 'react';

const NETWORK = process.env.NEXT_PUBLIC_AD_NETWORK;

// Process-wide cache of Pro status — one fetch per page load.
let proCache: { isPro: boolean; at: number } | null = null;
async function fetchIsPro(): Promise<boolean> {
  if (proCache && Date.now() - proCache.at < 60_000) return proCache.isPro;
  try {
    const res = await fetch('/api/me');
    if (!res.ok) return false;
    const data = (await res.json()) as { isPro?: boolean };
    proCache = { isPro: !!data.isPro, at: Date.now() };
    return !!data.isPro;
  } catch {
    return false;
  }
}

type SlotName = 'home-banner' | 'detail-banner' | 'watch-banner';

/**
 * Generic ad slot — renders a placeholder div tagged for the configured ad
 * network. The network's loader script (added to the root layout via
 * NEXT_PUBLIC_AD_SCRIPT) finds these by `data-tsumi-ad-slot` and fills them.
 *
 * Hidden entirely when:
 *   • No ad network is configured (`NEXT_PUBLIC_AD_NETWORK` unset), or
 *   • The viewer is a Tsumi Pro subscriber.
 *
 * Sizes are intentionally banner-friendly so they accept the IAB standard
 * 728×90 / 970×250 / 320×100 inventory most networks serve.
 */
export function AdSlot({
  slot,
  className = '',
}: {
  slot: SlotName;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!NETWORK) return;
    let active = true;
    fetchIsPro().then((isPro) => {
      if (active && !isPro) setShow(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!show) return null;

  return (
    <aside
      ref={ref}
      data-tsumi-ad-slot={slot}
      data-tsumi-ad-network={NETWORK}
      aria-label="Advertisement"
      className={`relative my-6 mx-auto flex w-full max-w-[970px] items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-surface/30 ${className}`}
      style={{ minHeight: 90 }}
    >
      <span className="text-[10px] uppercase tracking-[0.3em] text-zinc-600">
        Advertisement
      </span>
    </aside>
  );
}
