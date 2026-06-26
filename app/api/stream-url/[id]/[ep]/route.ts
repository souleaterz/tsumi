import { NextResponse } from 'next/server';
import { resolveStreams, resolvePlayable } from '@/lib/stream/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/stream-url/:id/:ep?t=<source title>
 *
 * Resolves the chosen source to a browser-playable stream server-side (so the
 * RD API key never reaches the browser). Returns `{ url, hls, mp4Fallback? }`:
 * mp4/webm files stream directly; mkv/other are transcoded by Real-Debrid to
 * HLS, with a progressive-MP4 fallback the player uses if HLS fails.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; ep: string } },
) {
  const anilistId = Number(params.id);
  const episode = Number(params.ep);
  const sourceTitle = new URL(req.url).searchParams.get('t') ?? '';

  if (!Number.isFinite(anilistId) || !Number.isFinite(episode) || !sourceTitle) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const sources = await resolveStreams(anilistId, episode);
  const match = sources.find((s) => s.title === sourceTitle && s.url);

  if (!match?.url) {
    return NextResponse.json({ error: 'Source no longer available' }, { status: 404 });
  }

  const playable = await resolvePlayable(match.url);
  if (!playable) {
    return NextResponse.json(
      { error: 'Real-Debrid could not resolve this source (it may not be cached).' },
      { status: 502 },
    );
  }

  return NextResponse.json(playable, { headers: { 'Cache-Control': 'no-store' } });
}
