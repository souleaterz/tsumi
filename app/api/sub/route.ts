export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/** Convert SRT to WebVTT (browsers prefer VTT in <track>). */
function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, '')
    // SRT separates ms with a comma; VTT uses a dot.
    .replace(/(\d\d:\d\d:\d\d),(\d\d\d)/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/sub?url=<encoded>
 * CORS-proxies a Jimaku-hosted subtitle file. SRT is converted to WebVTT
 * on the fly so it loads cleanly in a <track> element.
 */
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400, headers: CORS });

  let upstream: Response;
  try {
    upstream = await fetch(url, { redirect: 'follow' });
  } catch {
    return new Response('Upstream fetch failed', { status: 502, headers: CORS });
  }
  if (!upstream.ok) {
    return new Response('Upstream error', { status: upstream.status, headers: CORS });
  }

  const isSrt = /\.srt(\?|$)/i.test(url);
  const isVtt = /\.vtt(\?|$)/i.test(url);
  if (isSrt) {
    const text = await upstream.text();
    return new Response(srtToVtt(text), {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'text/vtt; charset=utf-8',
        'Cache-Control': 'public, s-maxage=86400',
      },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      ...CORS,
      'Content-Type': isVtt ? 'text/vtt; charset=utf-8' : 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400',
    },
  });
}
