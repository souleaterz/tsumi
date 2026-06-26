import { NextResponse } from 'next/server';
import { resolveStreams } from '@/lib/stream/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/streams/:id/:ep
 * Resolves Torrentio magnet sources for an AniList id + episode number.
 * Runs server-side so the Torrentio/Anizip calls aren't blocked by CORS.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; ep: string } },
) {
  const anilistId = Number(params.id);
  const episode = Number(params.ep);
  // Optional ?title= enables the Nyaa fallback when Torrentio has nothing.
  const title = new URL(req.url).searchParams.get('title') ?? undefined;

  if (!Number.isFinite(anilistId) || !Number.isFinite(episode)) {
    return NextResponse.json({ error: 'Invalid id or episode' }, { status: 400 });
  }

  try {
    const sources = await resolveStreams(anilistId, episode, title);
    return NextResponse.json(
      { sources },
      { headers: { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=600' } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to resolve streams', sources: [] },
      { status: 502 },
    );
  }
}
