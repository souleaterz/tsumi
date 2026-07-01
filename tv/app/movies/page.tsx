import { searchAnime } from '@shared/anilist/client';
import { HomeClient } from '@/components/tv/home-client';

export const revalidate = 1800;

const movieRail = (sort: string, perPage = 24) =>
  searchAnime({ format: 'MOVIE', sort: [sort], perPage }).then((r) => r.media).catch(() => []);

export default async function MoviesPage() {
  const [trending, popular, topRated] = await Promise.all([
    movieRail('TRENDING_DESC'),
    movieRail('POPULARITY_DESC'),
    movieRail('SCORE_DESC'),
  ]);

  const featured = trending[0] ?? popular[0] ?? topRated[0];
  if (!featured) {
    return <div className="px-[var(--tv-safe)] py-20 text-zinc-500">No movies to show right now.</div>;
  }

  return (
    <HomeClient
      featured={featured}
      rails={[
        { title: 'Trending movies', jp: '話題の映画', items: trending },
        { title: 'Popular movies', jp: '人気の映画', items: popular },
        { title: 'Top rated', jp: '高評価', items: topRated },
      ]}
    />
  );
}
