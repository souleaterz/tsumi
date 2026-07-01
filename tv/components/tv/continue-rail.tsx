'use client';

import { useEffect, useState } from 'react';
import type { AnilistMedia } from '@shared/anilist/types';
import { PosterCard } from './poster-card';
import { FocusSection } from './focusable';
import { getContinueWatching, subscribeProgress, type WatchProgress } from '@/lib/progress';

/**
 * "Continue watching" — in-progress episodes, resuming straight into the player.
 * Reads the local progress store (populated by the player as you watch); renders
 * nothing until there's something to resume, so first-run Home is unaffected.
 */
export function ContinueRail({ onFocusItem }: { onFocusItem?: (m: AnilistMedia) => void }) {
  const [items, setItems] = useState<WatchProgress[]>([]);

  useEffect(() => {
    const load = () => setItems(getContinueWatching());
    load();
    return subscribeProgress(load);
  }, []);

  if (!items.length) return null;

  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline gap-3 px-[var(--tv-safe)]">
        <h2 className="text-[1.15rem] font-medium text-white">Continue watching</h2>
        <span className="katakana text-[0.6rem]">続きを見る</span>
      </div>
      <FocusSection className="flex gap-4 overflow-x-auto scroll-px-[var(--tv-safe)] px-[var(--tv-safe)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((p, i) => {
          // Minimal AnilistMedia shape PosterCard needs for artwork + focus.
          const media = {
            id: p.id,
            title: { romaji: p.title, english: p.title },
            coverImage: { extraLarge: p.cover, large: p.cover },
          } as unknown as AnilistMedia;
          const pct = p.durationSec > 0 ? p.positionSec / p.durationSec : 0;
          return (
            <PosterCard
              key={`${p.id}-${p.ep}`}
              media={media}
              href={`/watch/${p.id}/${p.ep}`}
              progress={pct}
              caption={`Episode ${p.ep}`}
              autoFocus={i === 0}
              onFocusMedia={onFocusItem}
            />
          );
        })}
      </FocusSection>
    </section>
  );
}
