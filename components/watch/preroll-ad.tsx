'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Pre-roll ad gate for free-tier users.
 *
 * Wires up the Google IMA SDK when the script + an ad tag URL are present
 * (set NEXT_PUBLIC_IMA_AD_TAG). Without a configured ad tag it shows a short
 * skippable house placeholder so the free-vs-pro flow is demonstrable.
 *
 * Pro users never see this — the watch page renders the player directly.
 */
export function PreRollAd({ onComplete }: { onComplete: () => void }) {
  const [countdown, setCountdown] = useState(5);
  const adContainer = useRef<HTMLDivElement>(null);
  const adTag = process.env.NEXT_PUBLIC_IMA_AD_TAG;

  useEffect(() => {
    // Real IMA integration path.
    const ima = (window as any).google?.ima;
    if (adTag && ima && adContainer.current) {
      try {
        const display = new ima.AdDisplayContainer(adContainer.current);
        display.initialize();
        const loader = new ima.AdsLoader(display);
        loader.addEventListener(
          ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
          (e: any) => {
            const manager = e.getAdsManager(adContainer.current);
            manager.addEventListener(
              ima.AdEvent.Type.ALL_ADS_COMPLETED,
              onComplete,
            );
            manager.init(
              adContainer.current!.clientWidth,
              adContainer.current!.clientHeight,
              ima.ViewMode.NORMAL,
            );
            manager.start();
          },
        );
        const req = new ima.AdsRequest();
        req.adTagUrl = adTag;
        loader.requestAds(req);
        return;
      } catch {
        // Fall through to placeholder on any IMA failure.
      }
    }

    // House placeholder countdown.
    const id = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(id);
          onComplete();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [adTag, onComplete]);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-surface to-base shadow-glow-lg">
      <div ref={adContainer} className="absolute inset-0" />
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="relative z-10 text-center">
        <span className="katakana text-xs">広告</span>
        <p className="mt-2 font-heading text-3xl tracking-wider text-white">
          Advertisement
        </p>
        <p className="mt-2 text-sm text-zinc-400">
          Upgrade to <span className="text-accent">Tsumi Pro</span> to remove ads.
        </p>
      </div>
      <div className="absolute bottom-4 right-4 z-20">
        {countdown > 0 ? (
          <span className="rounded-md bg-base/80 px-3 py-1.5 text-sm text-zinc-300 backdrop-blur">
            Skip in {countdown}s
          </span>
        ) : (
          <button onClick={onComplete} className="btn-cta px-4 py-1.5 text-sm">
            Skip <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
