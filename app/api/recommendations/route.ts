import { NextResponse } from 'next/server';
import { getRecommendationsFor } from '@/lib/anilist/client';

/**
 * GET /api/recommendations?ids=1,2,3
 * "Because you watched" — aggregated AniList recommendations for the supplied
 * seed anime ids (the caller passes the user's recent history/watchlist).
 */
export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('ids') ?? '';
  const ids = raw
    .split(',')
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);

  if (ids.length === 0) return NextResponse.json({ results: [] });

  const results = await getRecommendationsFor(ids);
  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 's-maxage=600, stale-while-revalidate=300' } },
  );
}
