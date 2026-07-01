'use client';

import { useState } from 'react';
import type { AnilistMedia } from '@shared/anilist/types';
import { Hero } from './hero';
import { Rail } from './rail';
import { ContinueRail } from './continue-rail';

interface RailData {
  title: string;
  jp?: string;
  items: AnilistMedia[];
}

/**
 * Home layout with a PINNED hero: the hero occupies the top of the stage and
 * never moves — only the rails below it scroll. As the D-pad moves across the
 * posters, the hero swaps to whatever title is focused (Stremio/Google-TV feel).
 *
 * `showContinue` adds the "Continue watching" row at the top of the scroll area
 * (Home only; the Movies page reuses this layout without it).
 */
export function HomeClient({
  featured,
  rails,
  showContinue,
}: {
  featured: AnilistMedia;
  rails: RailData[];
  showContinue?: boolean;
}) {
  const [active, setActive] = useState<AnilistMedia>(featured);

  return (
    <div className="flex h-full flex-col">
      {/* Pinned — stays in place while the rails scroll under it. */}
      <div className="shrink-0">
        <Hero media={active} autoFocusPlay={false} />
      </div>

      {/* The only part that scrolls. */}
      <div className="relative z-20 -mt-6 flex-1 overflow-y-auto pb-16 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showContinue && <ContinueRail onFocusItem={setActive} />}
        {rails.map((r, ri) => (
          <Rail
            key={r.title}
            title={r.title}
            jp={r.jp}
            items={r.items}
            autoFocusFirst={ri === 0}
            onFocusItem={setActive}
          />
        ))}
      </div>
    </div>
  );
}
