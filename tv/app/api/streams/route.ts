import { NextResponse } from 'next/server';
import { resolveStreams, type StreamSource } from '@shared/stream/sources';

// Resolve sources for the TV watch page. Without an RD key this returns magnet
// sources (played natively by the shell's torrent client). The server-only
// `url` field (embeds any RD key) is stripped before the response leaves here.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const anilistId = Number(searchParams.get('id'));
  const episode = Number(searchParams.get('ep'));
  const title = searchParams.get('t') || undefined;
  const dub = searchParams.get('dub') === '1';
  // The RD key comes from the client (TV localStorage). Only used in the RD tab;
  // absent for the Torrentio (magnet) tab, which the shell streams peer-to-peer.
  const rdKey = searchParams.get('rdkey') || undefined;

  if (!Number.isFinite(anilistId) || !Number.isFinite(episode)) {
    return NextResponse.json({ sources: [] }, { status: 400 });
  }

  try {
    const sources = await resolveStreams(anilistId, episode, title, dub, rdKey);
    const safe = sources.map(({ url: _url, ...rest }: StreamSource) => rest);
    return NextResponse.json({ sources: safe });
  } catch (err) {
    return NextResponse.json(
      { sources: [], error: err instanceof Error ? err.message : 'Failed to resolve sources' },
      { status: 200 },
    );
  }
}
