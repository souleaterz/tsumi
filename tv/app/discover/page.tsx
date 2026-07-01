import { getTrending, getSeasonal, searchAnime } from '@shared/anilist/client';
import { PageTitle } from '@/components/tv/page-title';
import { Rail } from '@/components/tv/rail';

export const revalidate = 1800;

async function genreRail(genre: string) {
  try {
    const { media } = await searchAnime({ genre, sort: ['POPULARITY_DESC'], perPage: 20 });
    return media;
  } catch {
    return [];
  }
}

// Curated, editorial rows — a browsing-for-something-new surface.
export default async function DiscoverPage() {
  const [trendingR, seasonalR, topRatedR, action, romance, fantasy] = await Promise.allSettled([
    getTrending(20),
    getSeasonal(20),
    searchAnime({ sort: ['SCORE_DESC'], perPage: 20 }).then((r) => r.media),
    genreRail('Action'),
    genreRail('Romance'),
    genreRail('Fantasy'),
  ]);
  const val = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === 'fulfilled' ? r.value : fallback;

  return (
    <div className="pb-16">
      <PageTitle title="Discover" jp="発見" />
      <Rail title="Trending now" jp="トレンド" items={val(trendingR, [])} autoFocusFirst />
      <Rail title="Top rated of all time" jp="高評価" items={val(topRatedR, [])} />
      <Rail title="Fresh this season" jp="今期" items={val(seasonalR, [])} />
      <Rail title="Action" jp="アクション" items={val(action, [])} />
      <Rail title="Romance" jp="恋愛" items={val(romance, [])} />
      <Rail title="Fantasy" jp="ファンタジー" items={val(fantasy, [])} />
    </div>
  );
}
