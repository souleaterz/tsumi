import Link from 'next/link';
import { searchAnime, getGenres } from '@/lib/anilist/client';
import { AnimeCard } from '@/components/ui/anime-card';
import { FilterBar } from '@/components/browse/filter-bar';
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-react';

export const revalidate = 300;

interface SearchParams {
  search?: string;
  genre?: string;
  seasonYear?: string;
  format?: string;
  status?: string;
  sort?: string;
  page?: string;
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const page = Math.max(1, Number(searchParams.page) || 1);

  const [genres, result] = await Promise.all([
    getGenres(),
    searchAnime({
      search: searchParams.search,
      genre: searchParams.genre,
      seasonYear: searchParams.seasonYear ? Number(searchParams.seasonYear) : undefined,
      format: searchParams.format,
      status: searchParams.status,
      sort: [searchParams.sort || 'POPULARITY_DESC'],
      page,
      perPage: 28,
    }),
  ]);

  const { media, pageInfo } = result;
  const qs = (p: number) => {
    const sp = new URLSearchParams(searchParams as Record<string, string>);
    sp.set('page', String(p));
    return `/browse?${sp.toString()}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="relative mb-2">
        <span className="katakana absolute -top-2 left-0 text-[10px]">ブラウズ</span>
        <h1 className="text-4xl text-white sm:text-5xl">
          {searchParams.search ? (
            <>
              Results for <span className="text-accent">“{searchParams.search}”</span>
            </>
          ) : (
            'Browse Anime'
          )}
        </h1>
      </div>
      <p className="mb-6 text-sm text-zinc-500">
        {pageInfo.total.toLocaleString()} titles · page {pageInfo.currentPage} of{' '}
        {pageInfo.lastPage}
      </p>

      <FilterBar genres={genres} />

      {media.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-center text-zinc-500">
          <SearchX className="h-12 w-12 text-zinc-700" />
          <p className="text-lg">No anime matched your filters.</p>
          <Link href="/browse" className="btn-ghost mt-2">
            Reset filters
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {media.map((m, i) => (
            <AnimeCard key={m.id} media={m} index={i} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {media.length > 0 && (
        <div className="mt-10 flex items-center justify-center gap-4">
          {page > 1 ? (
            <Link href={qs(page - 1)} className="btn-ghost px-4 py-2 text-sm">
              <ChevronLeft className="h-4 w-4" /> Prev
            </Link>
          ) : (
            <span className="btn-ghost cursor-not-allowed px-4 py-2 text-sm opacity-40">
              <ChevronLeft className="h-4 w-4" /> Prev
            </span>
          )}
          <span className="text-sm text-zinc-400">
            {page} / {pageInfo.lastPage}
          </span>
          {pageInfo.hasNextPage ? (
            <Link href={qs(page + 1)} className="btn-ghost px-4 py-2 text-sm">
              Next <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="btn-ghost cursor-not-allowed px-4 py-2 text-sm opacity-40">
              Next <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}
