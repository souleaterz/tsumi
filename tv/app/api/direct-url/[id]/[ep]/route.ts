import { NextResponse } from 'next/server';
import { resolveStreams, resolveFinalUrl } from '@shared/stream/sources';

export const dynamic = 'force-dynamic';

/**
 * GET /api/direct-url/:id/:ep?t=<source title>&rdkey=<key>
 *
 * Returns the keyless, directly-playable Real-Debrid link for a source (the raw
 * container on RD's CDN, no transcode) so the Fire TV shell's native player can
 * play it smoothly. Unlike the website, the TV app has no Clerk session — the RD
 * key is supplied by the client (from the TV's local settings / pairing). The
 * key never leaves the server in the response: resolveFinalUrl follows the RD
 * redirect here and we return only the final keyless CDN URL.
 */
export async function GET(req: Request, { params }: { params: { id: string; ep: string } }) {
  const anilistId = Number(params.id);
  const episode = Number(params.ep);
  const { searchParams } = new URL(req.url);
  const sourceTitle = searchParams.get('t') ?? '';
  const rdKey = searchParams.get('rdkey') ?? '';

  if (!Number.isFinite(anilistId) || !Number.isFinite(episode) || !sourceTitle) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  if (!rdKey) {
    return NextResponse.json({ error: 'No Real-Debrid key. Add one in Settings.' }, { status: 403 });
  }

  const sources = await resolveStreams(anilistId, episode, undefined, false, rdKey);
  const match = sources.find((s) => s.title === sourceTitle && s.url);
  if (!match?.url) {
    return NextResponse.json({ error: 'Source no longer available' }, { status: 404 });
  }

  const finalUrl = await resolveFinalUrl(match.url);
  if (!finalUrl) {
    return NextResponse.json({ error: 'Real-Debrid could not resolve this source (not cached).' }, { status: 502 });
  }

  return NextResponse.json({ url: finalUrl, container: match.quality ?? null }, { headers: { 'Cache-Control': 'no-store' } });
}
