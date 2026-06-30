import { NextResponse } from 'next/server';
import { resolveStreams } from '@/lib/stream/sources';
import { currentUserId } from '@/lib/subscription';
import { getUserRdKey } from '@/lib/settings';

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
    const rdKey = (await getUserRdKey(await currentUserId())) ?? undefined;
    const resolved = await resolveStreams(anilistId, episode, title, false, rdKey);
    // Strip the Real-Debrid resolver URL (it embeds the API key) and expose the
    // keyless /api/stream-url endpoint instead.
    const sources = resolved.map((s) => {
      const { url, ...safe } = s;
      return url
        ? {
            ...safe,
            playUrl: `/api/stream-url/${anilistId}/${episode}?t=${encodeURIComponent(s.title)}`,
          }
        : safe;
    });
    // Don't cache publicly in RD mode — resolver state is per-request.
    const headers = resolved.some((s) => s.url)
      ? { 'Cache-Control': 'no-store' }
      : { 'Cache-Control': 's-maxage=1800, stale-while-revalidate=600' };
    return NextResponse.json({ sources }, { headers });
  } catch (err) {
    return NextResponse.json(
      { error: 'Failed to resolve streams', sources: [] },
      { status: 502 },
    );
  }
}
