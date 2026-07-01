import { searchAnime } from '@shared/anilist/client';
import { PageTitle } from '@/components/tv/page-title';
import { FilterBar } from '@/components/tv/filter-bar';
import { PosterGrid } from '@/components/tv/poster-grid';

export const revalidate = 600;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: { sort?: string; genre?: string; year?: string };
}) {
  const sort = searchParams.sort || 'TRENDING_DESC';
  const genre = searchParams.genre;
  const year = searchParams.year ? Number(searchParams.year) : undefined;

  let media: Awaited<ReturnType<typeof searchAnime>>['media'] = [];
  try {
    const res = await searchAnime({ sort: [sort], genre, seasonYear: year, perPage: 30 });
    media = res.media;
  } catch {
    media = [];
  }

  return (
    <div>
      <PageTitle title="Browse" jp="一覧" />
      <FilterBar />
      <PosterGrid items={media} />
    </div>
  );
}
