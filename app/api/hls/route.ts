export const dynamic = 'force-dynamic';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
};

/** Rewrite a child URI (segment / sub-playlist / key) back through this proxy. */
function proxify(uri: string, baseUrl: string, referer?: string): string {
  let abs: string;
  try {
    abs = new URL(uri, baseUrl).toString();
  } catch {
    abs = uri;
  }
  const ref = referer ? `&ref=${encodeURIComponent(referer)}` : '';
  return `/api/hls?url=${encodeURIComponent(abs)}${ref}`;
}

/** Rewrite every URI in an m3u8 playlist so children load through the proxy. */
function rewritePlaylist(text: string, baseUrl: string, referer?: string): string {
  return text
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) {
        // URI="..." appears in EXT-X-KEY, EXT-X-MEDIA, EXT-X-MAP, etc.
        return line.replace(
          /URI="([^"]+)"/g,
          (_m, uri) => `URI="${proxify(uri, baseUrl, referer)}"`,
        );
      }
      return proxify(t, baseUrl, referer);
    })
    .join('\n');
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

/**
 * GET /api/hls?url=<encoded>&ref=<encoded referer>
 * Proxies provider HLS playlists and segments, injecting the Referer their CDN
 * requires (browsers can't set it) and adding CORS so the player can fetch them.
 */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const target = sp.get('url');
  const referer = sp.get('ref') ?? undefined;
  if (!target) return new Response('Missing url', { status: 400, headers: CORS });

  const headers: Record<string, string> = {};
  if (referer) {
    headers['Referer'] = referer;
    try {
      headers['Origin'] = new URL(referer).origin;
    } catch {
      /* ignore */
    }
  }
  const range = req.headers.get('range');
  if (range) headers['Range'] = range;

  let upstream: Response;
  try {
    upstream = await fetch(target, { headers, redirect: 'follow' });
  } catch {
    return new Response('Upstream fetch failed', { status: 502, headers: CORS });
  }

  const contentType = upstream.headers.get('content-type') ?? '';
  const isPlaylist =
    /mpegurl/i.test(contentType) || /\.m3u8(\?|$)/i.test(target);

  if (isPlaylist) {
    const text = await upstream.text();
    const rewritten = rewritePlaylist(text, upstream.url || target, referer);
    return new Response(rewritten, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    });
  }

  // Stream segments / keys straight through, preserving range semantics.
  const passthrough: Record<string, string> = { ...CORS };
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
    const v = upstream.headers.get(h);
    if (v) passthrough[h] = v;
  }
  return new Response(upstream.body, { status: upstream.status, headers: passthrough });
}
