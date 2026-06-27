'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Play, Info, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import type { AnilistMedia } from '@/lib/anilist/types';
import { bestTitle, formatFormat, formatScore, stripHtml, truncate } from '@/lib/utils';

export function Hero({ items }: { items: AnilistMedia[] }) {
  const slides = items.slice(0, 5);
  const [active, setActive] = useState(0);
  // Bumped whenever the user navigates manually, to reset the auto-advance timer.
  const [nudge, setNudge] = useState(0);

  const go = (dir: 1 | -1) => {
    setActive((a) => (a + dir + slides.length) % slides.length);
    setNudge((n) => n + 1);
  };

  // Auto-advance every 7s (restarts after a manual nav so it doesn't jump).
  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => setActive((a) => (a + 1) % slides.length), 7000);
    return () => clearInterval(id);
  }, [slides.length, nudge]);

  if (slides.length === 0) return null;
  const media = slides[active];
  const banner = media.bannerImage || media.coverImage?.extraLarge;
  const accent = media.coverImage?.color || '#7C3AED';
  const title = bestTitle(media.title);

  return (
    <section className="relative h-[78vh] min-h-[520px] w-full overflow-hidden">
      {/* Background */}
      {banner && (
        <Image
          key={media.id}
          src={banner}
          alt={title}
          fill
          priority
          sizes="100vw"
          className="animate-[fade-up_0.8s_ease-out] object-cover object-center"
        />
      )}

      {/* Cinematic gradients */}
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/85 to-base/20" />
      <div className="absolute inset-0 bg-gradient-to-r from-base via-base/75 to-transparent" />
      <div className="grain pointer-events-none absolute inset-0" />

      {/* Carousel arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous"
            className="absolute left-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/50 text-white backdrop-blur transition hover:border-primary/60 hover:bg-base/80 hover:shadow-glow sm:left-4 sm:h-12 sm:w-12"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next"
            className="absolute right-2 top-1/2 z-20 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-base/50 text-white backdrop-blur transition hover:border-primary/60 hover:bg-base/80 hover:shadow-glow sm:right-4 sm:h-12 sm:w-12"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </>
      )}

      {/* Decorative katakana */}
      <div className="pointer-events-none absolute right-6 top-24 hidden flex-col items-end gap-2 lg:flex">
        <span className="font-jp text-7xl text-white/5">罪</span>
        <span className="katakana text-sm">トレンド・ナンバーワン</span>
      </div>

      {/* Content */}
      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-24 sm:px-6">
        <span
          className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest"
          style={{ borderColor: `${accent}66`, color: accent }}
        >
          <span className="h-1.5 w-1.5 animate-glow-pulse rounded-full" style={{ background: accent }} />
          #{active + 1} Trending
        </span>

        <h1 className="max-w-3xl text-5xl leading-[0.95] text-white text-glow sm:text-7xl">
          {title}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-zinc-300">
          {media.averageScore ? (
            <span className="flex items-center gap-1 font-semibold">
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
              {formatScore(media.averageScore)}
            </span>
          ) : null}
          {media.format && <span>{formatFormat(media.format)}</span>}
          {media.seasonYear && <span>{media.seasonYear}</span>}
          {media.episodes && <span>{media.episodes} episodes</span>}
          <div className="hidden gap-2 sm:flex">
            {media.genres?.slice(0, 3).map((g) => (
              <span key={g} className="rounded bg-white/10 px-2 py-0.5 text-xs">
                {g}
              </span>
            ))}
          </div>
        </div>

        <p
          className="mt-4 max-w-2xl text-sm font-medium leading-relaxed text-zinc-50 sm:text-base"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.85), 0 1px 3px rgba(0,0,0,0.95)' }}
        >
          {truncate(stripHtml(media.description), 240)}
        </p>

        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link href={`/watch/${media.id}/1`} className="btn-cta">
            <Play className="h-5 w-5 fill-current" />
            Watch Now
          </Link>
          <Link href={`/anime/${media.id}`} className="btn-ghost">
            <Info className="h-5 w-5" />
            Details
          </Link>
        </div>

        {/* Slide indicators */}
        <div className="mt-8 flex gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => setActive(i)}
              aria-label={`Show slide ${i + 1}`}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                width: i === active ? 40 : 16,
                background: i === active ? accent : 'rgba(255,255,255,0.25)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
