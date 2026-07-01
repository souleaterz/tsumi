'use client';

import { useEffect, useRef, useState } from 'react';
import { adUnitAt, adsEnabled } from '@/lib/ads';

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

/**
 * Adsterra native-banner ad slot.
 *
 * Each slot maps to one ad unit (by index into `AD_UNITS` in lib/ads.ts). On
 * mount it builds the exact pair Adsterra expects — a `#container-<key>` div
 * plus the matching `invoke.js` <script> — inside this slot. Injecting the
 * script per-mount (rather than once globally in the layout) is what makes it
 * refill correctly on client-side navigation, where a global loader would only
 * ever have scanned the first page it loaded on.
 *
 * Renders nothing when:
 *   • ads are disabled (NEXT_PUBLIC_ADS_DISABLED=true or no units configured),
 *   • there's no ad unit for this `unit` index (i.e. you haven't added a
 *     second/third Adsterra zone yet — extra slots stay dormant), or
 *   • the viewer is a Tsumi Pro subscriber.
 */
export function AdSlot({
  unit = 0,
  className = '',
}: {
  /** Index into AD_UNITS. Distinct indexes → distinct Adsterra zones. */
  unit?: number;
  className?: string;
}) {
  const adUnit = adsEnabled ? adUnitAt(unit) : undefined;
  const [show, setShow] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);

  // Decide whether to show (skip for Pro users).
  useEffect(() => {
    if (!adUnit) return;
    let active = true;
    fetchIsPro().then((isPro) => {
      if (active && !isPro) setShow(true);
    });
    return () => {
      active = false;
    };
  }, [adUnit]);

  // Build the Adsterra container + invoke script once we've decided to show.
  useEffect(() => {
    if (!show || !adUnit) return;
    const host = hostRef.current;
    if (!host) return;

    host.innerHTML = '';

    const container = document.createElement('div');
    container.id = `container-${adUnit.key}`;
    host.appendChild(container);

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = adUnit.src;
    host.appendChild(script);

    return () => {
      host.innerHTML = '';
    };
  }, [show, adUnit]);

  if (!adUnit || !show) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`relative my-6 mx-auto flex w-full max-w-[970px] flex-col items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-surface/30 p-2 ${className}`}
      style={{ minHeight: 90 }}
    >
      <span className="mb-1 text-[10px] uppercase tracking-[0.3em] text-zinc-600">
        Advertisement
      </span>
      <div ref={hostRef} className="w-full" />
    </aside>
  );
}
