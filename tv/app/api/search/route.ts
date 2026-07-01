import { NextResponse } from 'next/server';
import { searchAnime } from '@shared/anilist/client';

// Thin wrapper over the shared AniList search so the client Search page can
// fetch results without importing server-only code. Lives in the TV app's own
// api tree — the main website's routes are untouched.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('q')?.trim();
  const genre = searchParams.get('genre') || undefined;
  const seasonYear = searchParams.get('year') ? Number(searchParams.get('year')) : undefined;
  const format = searchParams.get('format') || undefined;
  const sort = searchParams.get('sort') || undefined;

  if (!search && !genre && !seasonYear && !format && !sort) {
    return NextResponse.json({ media: [] });
  }

  try {
    const { media } = await searchAnime({
      search,
      genre,
      seasonYear,
      format,
      sort: sort ? [sort] : undefined,
      perPage: 30,
    });
    return NextResponse.json({ media });
  } catch (err) {
    return NextResponse.json(
      { media: [], error: err instanceof Error ? err.message : 'Search failed' },
      { status: 200 },
    );
  }
}
