'use client';

import type { AnilistMedia } from '@shared/anilist/types';
import { PosterCard } from './poster-card';
import { FocusSection } from './focusable';

/** A responsive grid of poster cards used by Browse / Search / Discover. */
export function PosterGrid({ items }: { items: AnilistMedia[] }) {
  if (!items.length) {
    return (
      <p className="px-[var(--tv-safe)] py-10 text-zinc-500">No titles found.</p>
    );
  }
  return (
    <FocusSection className="grid grid-cols-6 gap-x-4 gap-y-6 px-[var(--tv-safe)] pb-16">
      {items.map((m, i) => (
        // Compound key: AniList can return the same id twice across pages/filters,
        // and duplicate keys make React omit a card — a poster silently missing
        // from the grid.
        <PosterCard key={`${m.id}-${i}`} media={m} />
      ))}
    </FocusSection>
  );
}
