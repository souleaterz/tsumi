import { getTrending, getSeasonal, getPopular, currentSeason } from '@shared/anilist/client';
import { HomeClient } from '@/components/tv/home-client';

// Server-rendered with periodic refresh, exactly like the website's home.
export const revalidate = 1800;

export default async function TvHome() {
  // allSettled keeps the page resilient to a transient AniList rate-limit.
  const [trendingR, seasonalR, popularR] = await Promise.allSettled([
    getTrending(24),
    getSeasonal(18),
    getPopular(24),
  ]);
  const trending = trendingR.status === 'fulfilled' ? trendingR.value : [];
  const seasonal = seasonalR.status === 'fulfilled' ? seasonalR.value : [];
  const popular = popularR.status === 'fulfilled' ? popularR.value : [];

  const featured = trending[0] ?? seasonal[0] ?? popular[0];
  const { season, year } = currentSeason();
  const seasonLabel = `${season.charAt(0)}${season.slice(1).toLowerCase()} ${year}`;

  if (!featured) {
    return <div className="px-[var(--tv-safe)] py-20 text-zinc-500">Couldn’t reach AniList. Try again shortly.</div>;
  }

  return (
    <HomeClient
      featured={featured}
      showContinue
      rails={[
        { title: 'Trending now', jp: 'トレンド', items: trending },
        { title: `This season — ${seasonLabel}`, jp: '今期のアニメ', items: seasonal },
        { title: 'All-time popular', jp: '人気作品', items: popular },
      ]}
    />
  );
}
