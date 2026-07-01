'use client';

import type { AnilistMedia } from '@shared/anilist/types';
import { PosterCard } from './poster-card';
import { FocusSection } from './focusable';

interface Props {
  title: string;
  jp?: string;
  items: AnilistMedia[];
  /** Auto-focus the first card (use on the first rail of a page). */
  autoFocusFirst?: boolean;
  /** Fires when a card in this rail gains focus — Home swaps the hero to it. */
  onFocusItem?: (media: AnilistMedia) => void;
}

/** A titled horizontal rail of poster cards (Stremio-style). */
export function Rail({ title, jp, items, autoFocusFirst, onFocusItem }: Props) {
  if (!items.length) return null;
  return (
    <section className="mb-9">
      <div className="mb-3 flex items-baseline gap-3 px-[var(--tv-safe)]">
        <h2 className="text-[1.15rem] font-medium text-white">{title}</h2>
        {jp && <span className="katakana text-[0.6rem]">{jp}</span>}
      </div>
      <FocusSection className="flex gap-4 overflow-x-auto scroll-px-[var(--tv-safe)] px-[var(--tv-safe)] pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((m, i) => (
          <PosterCard key={`${m.id}-${i}`} media={m} autoFocus={autoFocusFirst && i === 0} onFocusMedia={onFocusItem} />
        ))}
      </FocusSection>
    </section>
  );
}
