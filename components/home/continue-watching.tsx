'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Play } from 'lucide-react';
import { getContinueWatching, type ProgressEntry } from '@/lib/progress';
import { SectionHeader } from '@/components/ui/section-header';
import { useUserId } from '@/lib/auth/use-user-id';

export function ContinueWatching() {
  const [items, setItems] = useState<ProgressEntry[] | null>(null);
  const { userId, isLoaded } = useUserId();

  useEffect(() => {
    // Wait for Clerk to resolve, then read from Supabase (signed in) or
    // localStorage (signed out / Clerk not configured).
    if (!isLoaded) return;
    getContinueWatching(userId).then(setItems);
  }, [isLoaded, userId]);

  // Hide the whole section when there's nothing to resume.
  if (!items || items.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <SectionHeader title="Continue Watching" jp="続きを見る" />
      <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
        {items.map((entry) => {
          const pct =
            entry.durationSec > 0
              ? Math.min(100, (entry.positionSec / entry.durationSec) * 100)
              : 0;
          return (
            <Link
              key={`${entry.anilistId}-${entry.episode}`}
              href={`/watch/${entry.anilistId}/${entry.episode}`}
              className="card-glow group relative w-[280px] shrink-0 overflow-hidden rounded-xl"
            >
              <div className="relative aspect-video overflow-hidden rounded-xl bg-surface">
                {entry.coverImage && (
                  <Image
                    src={entry.coverImage}
                    alt={entry.title}
                    fill
                    sizes="280px"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-base via-base/30 to-transparent" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-glow">
                    <Play className="h-5 w-5 translate-x-px fill-current" />
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="katakana mb-0.5 text-[8px]">エピソード {entry.episode}</p>
                  <h3 className="line-clamp-1 text-sm font-semibold text-white">
                    {entry.title}
                  </h3>
                  <p className="text-[11px] text-zinc-400">Episode {entry.episode}</p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-white/15">
                <div
                  className="h-full bg-gradient-to-r from-primary to-accent"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
