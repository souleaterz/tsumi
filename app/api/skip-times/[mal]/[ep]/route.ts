import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/skip-times/:mal/:ep?len=<episodeSeconds>
 *
 * Proxies AniSkip (https://api.aniskip.com) — a community database of opening /
 * ending timestamps keyed by MyAnimeList id + episode number. We use it to:
 *   • draw intro/outro markers on the embedded mpv seek bar (as chapters), and
 *   • show contextual "Skip Intro" / "Next Episode" buttons during playback.
 *
 * Returns a small normalised shape: { op?: {start,end}, ed?: {start,end} }.
 * Server-side so there's no browser CORS dependency on AniSkip.
 */
export async function GET(
  _req: Request,
  { params }: { params: { mal: string; ep: string } },
) {
  const mal = Number(params.mal);
  const ep = Number(params.ep);
  if (!Number.isFinite(mal) || mal <= 0 || !Number.isFinite(ep) || ep < 1) {
    return NextResponse.json({}, { status: 200 });
  }

  const len = Number(new URL(_req.url).searchParams.get('len')) || 0;
  const url =
    `https://api.aniskip.com/v2/skip-times/${mal}/${ep}` +
    `?types=op&types=ed&episodeLength=${Math.max(0, Math.round(len))}`;

  try {
    const res = await fetch(url, {
      headers: { accept: 'application/json' },
      // AniSkip is best-effort enrichment — don't hang playback on it.
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return NextResponse.json({}, { status: 200 });
    const data = (await res.json()) as {
      found?: boolean;
      results?: {
        skipType?: string;
        interval?: { startTime?: number; endTime?: number };
      }[];
    };

    const out: {
      op?: { start: number; end: number };
      ed?: { start: number; end: number };
    } = {};
    for (const r of data.results ?? []) {
      const i = r.interval;
      if (!i || typeof i.startTime !== 'number' || typeof i.endTime !== 'number') {
        continue;
      }
      const seg = { start: i.startTime, end: i.endTime };
      if (r.skipType === 'op' || r.skipType === 'mixed-op') out.op = seg;
      else if (r.skipType === 'ed' || r.skipType === 'mixed-ed') out.ed = seg;
    }

    return NextResponse.json(out, {
      headers: { 'Cache-Control': 'public, max-age=86400' },
    });
  } catch {
    return NextResponse.json({}, { status: 200 });
  }
}
