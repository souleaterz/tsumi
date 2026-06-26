'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnilistMedia } from '@/lib/anilist/types';
import { AnimeCard } from './anime-card';

export function CardRow({ items }: { items: AnilistMedia[] }) {
  const scroller = useRef<HTMLDivElement>(null);

  function scroll(dir: 1 | -1) {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: 'smooth' });
  }

  return (
    <div className="group/row relative">
      <div
        ref={scroller}
        className="no-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {items.map((media, i) => (
          <div
            key={media.id}
            className="w-[44vw] shrink-0 snap-start sm:w-[200px]"
          >
            <AnimeCard media={media} index={i} />
          </div>
        ))}
      </div>

      {/* Arrows (desktop) */}
      <button
        onClick={() => scroll(-1)}
        aria-label="Scroll left"
        className="absolute -left-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/80 text-white opacity-0 backdrop-blur transition hover:border-primary/60 hover:shadow-glow group-hover/row:opacity-100 md:flex"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        onClick={() => scroll(1)}
        aria-label="Scroll right"
        className="absolute -right-4 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/80 text-white opacity-0 backdrop-blur transition hover:border-primary/60 hover:shadow-glow group-hover/row:opacity-100 md:flex"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
