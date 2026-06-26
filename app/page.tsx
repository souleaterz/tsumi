import Link from 'next/link';
import { getPopular, getSeasonal, getTrending, currentSeason } from '@/lib/anilist/client';
import { Hero } from '@/components/home/hero';
import { ContinueWatching } from '@/components/home/continue-watching';
import { Recommended } from '@/components/home/recommended';
import { CardRow } from '@/components/ui/card-row';
import { AnimeCard } from '@/components/ui/anime-card';
import { SectionHeader } from '@/components/ui/section-header';
import { GenreTag } from '@/components/ui/genre-tag';

// Refresh server-rendered data periodically.
export const revalidate = 1800;

const FEATURED_GENRES = [
  'Action',
  'Adventure',
  'Fantasy',
  'Romance',
  'Comedy',
  'Drama',
  'Sci-Fi',
  'Supernatural',
  'Mystery',
  'Thriller',
  'Slice of Life',
  'Psychological',
];

export default async function HomePage() {
  // Pull everything in parallel from AniList. allSettled keeps the page (and
  // the build) resilient to a transient AniList rate-limit — ISR refills any
  // section that momentarily failed on the next revalidation.
  const [trendingR, seasonalR, popularR] = await Promise.allSettled([
    getTrending(24),
    getSeasonal(18),
    getPopular(12),
  ]);
  const trending = trendingR.status === 'fulfilled' ? trendingR.value : [];
  const seasonal = seasonalR.status === 'fulfilled' ? seasonalR.value : [];
  const popular = popularR.status === 'fulfilled' ? popularR.value : [];

  const { season, year } = currentSeason();
  const seasonLabel = `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`;

  return (
    <div className="relative">
      {/* HERO */}
      <Hero items={trending} />

      {/* CONTINUE WATCHING (client; hidden when empty) */}
      <ContinueWatching />

      {/* RECOMMENDED FROM HISTORY (client; hidden until there's signal) */}
      <Recommended />

      {/* TRENDING */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionHeader
          title="Trending Now"
          jp="トレンド"
          href="/browse?sort=TRENDING_DESC"
        />
        <CardRow items={trending} />
      </section>

      {/* SEASONAL — diagonal accent band */}
      <section className="relative my-10">
        <div className="clip-diagonal grain relative bg-gradient-to-br from-surface/80 via-base to-base py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeader
              title={`This Season — ${seasonLabel}`}
              jp="今期のアニメ"
              href="/browse"
              hrefLabel="Browse season"
            />
            <CardRow items={seasonal} />
          </div>
        </div>
      </section>

      {/* GENRES */}
      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <SectionHeader title="Browse by Genre" jp="ジャンル" />
        <div className="flex flex-wrap gap-2.5">
          {FEATURED_GENRES.map((g) => (
            <GenreTag key={g} genre={g} />
          ))}
        </div>
      </section>

      {/* ALL-TIME POPULAR GRID */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <SectionHeader
          title="All-Time Popular"
          jp="人気作品"
          href="/browse?sort=POPULARITY_DESC"
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {popular.map((media, i) => (
            <AnimeCard key={media.id} media={media} index={i} />
          ))}
        </div>
      </section>

      {/* PRO CTA */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/20 via-surface to-base p-8 shadow-glow sm:p-12">
          <div className="grain pointer-events-none absolute inset-0" />
          <span className="font-jp pointer-events-none absolute -right-4 -top-6 text-9xl text-white/5">
            罪
          </span>
          <div className="relative z-10 max-w-xl">
            <span className="katakana text-xs">ツミ・プロ</span>
            <h2 className="mt-2 text-4xl text-white sm:text-5xl">
              Go Pro. <span className="text-accent text-glow">No Ads. Ever.</span>
            </h2>
            <p className="mt-3 text-zinc-300">
              HD streaming is free for everyone. Go Pro to remove all ads, get early
              access to new features, and support Tsumi for just
              <span className="font-semibold text-white"> £0.99/month</span>. Cancel
              anytime.
            </p>
            <Link href="/profile" className="btn-cta mt-6">
              Upgrade to Pro
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
