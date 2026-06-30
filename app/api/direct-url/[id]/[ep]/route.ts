import { NextResponse } from 'next/server';
import { resolveStreams, resolveFinalUrl } from '@/lib/stream/sources';
import { currentUserId } from '@/lib/subscription';
import { getUserRdKey } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * GET /api/direct-url/:id/:ep?t=<source title>
 *
 * Returns the **keyless, directly-playable Real-Debrid link** for a source —
 * the raw container (usually .mkv) on RD's CDN, NOT a transcode.
 *
 * This is the desktop app's playback path: a native player (mpv) plays the raw
 * mkv directly over HTTP byte-range, with no live transcoding — which is the
 * whole reason the desktop build exists (it sidesteps RD's transcode wall that
 * stutters the browser around 0:30). The browser path keeps using
 * /api/stream-url (which transcodes mkv to HLS because browsers can't decode it).
 *
 * The RD API key is the signed-in user's own (BYO-key) and never leaves the
 * server — `resolveFinalUrl` follows the resolver redirect here and we hand the
 * client only the final keyless CDN URL.
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

  const rdKey = (await getUserRdKey(await currentUserId())) ?? undefined;
  if (!rdKey) {
    return NextResponse.json(
      { error: 'Add your Real-Debrid key in your profile to stream this source.' },
      { status: 403 },
    );
  }

  const sources = await resolveStreams(anilistId, episode, undefined, false, rdKey);
  const match = sources.find((s) => s.title === sourceTitle && s.url);
  if (!match?.url) {
    return NextResponse.json({ error: 'Source no longer available' }, { status: 404 });
  }

  const finalUrl = await resolveFinalUrl(match.url);
  if (!finalUrl) {
    return NextResponse.json(
      { error: 'Real-Debrid could not resolve this source (it may not be cached).' },
      { status: 502 },
    );
  }

  return NextResponse.json(
    { url: finalUrl, container: match.quality ?? null },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
