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
      {items.map((m) => (
        <PosterCard key={m.id} media={m} />
      ))}
    </FocusSection>
  );
}
