import { NextResponse } from 'next/server';
import { searchSuggestions } from '@/lib/anilist/client';

/**
 * GET /api/search?q=<query>
 * Lightweight search-as-you-type suggestions from AniList (fuzzy match handles
 * typos). Cached briefly at the edge.
 */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const results = await searchSuggestions(q);
  return NextResponse.json(
    { results },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=120' } },
  );
}
