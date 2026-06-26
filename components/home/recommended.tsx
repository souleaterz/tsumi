'use client';

import { useEffect, useState } from 'react';
import type { AnilistMedia } from '@/lib/anilist/types';
import { getContinueWatching } from '@/lib/progress';
import { getWatchlist } from '@/lib/watchlist';
import { useUserId } from '@/lib/auth/use-user-id';
import { CardRow } from '@/components/ui/card-row';
import { SectionHeader } from '@/components/ui/section-header';

/**
 * "Because You Watched" — recommendations seeded from the viewer's recent
 * history + watchlist. Hidden until there's enough signal to recommend from.
 */
export function Recommended() {
  const { userId, isLoaded } = useUserId();
  const [items, setItems] = useState<AnilistMedia[] | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    (async () => {
      const [history, list] = await Promise.all([
        getContinueWatching(userId, 12, true),
        getWatchlist(userId),
      ]);
      // Seed from most-recent activity, history first.
      const seeds = Array.from(
        new Set([
          ...history.map((h) => h.anilistId),
          ...list.map((w) => w.anilistId),
        ]),
      );
      if (seeds.length === 0) {
        if (active) setItems([]);
        return;
      }
      const res = await fetch(`/api/recommendations?ids=${seeds.slice(0, 6).join(',')}`);
      const data = await res.json().catch(() => ({ results: [] }));
      if (active) setItems(data.results ?? []);
    })();
    return () => {
      active = false;
    };
  }, [isLoaded, userId]);

  if (!items || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeader title="Because You Watched" jp="あなたへのおすすめ" />
      <CardRow items={items} />
    </section>
  );
}
