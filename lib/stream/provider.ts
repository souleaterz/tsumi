import 'server-only';

// ─────────────────────────────────────────────────────────────
// Streaming-provider source resolution (Consumet meta/anilist).
//
// Unlike Torrentio/Real-Debrid (torrents → transcode), a provider API returns
// ready-to-play HLS streams with native SUB and DUB variants plus subtitle
// tracks. Requires a self-hosted Consumet instance (the public ones are dead):
//   https://github.com/consumet/api.consumet.org  →  set CONSUMET_API_URL.
//
// Provider HLS often requires a Referer header the browser can't set, so the
// URLs are routed through our /api/hls proxy.
// ─────────────────────────────────────────────────────────────

const CONSUMET_URL = process.env.CONSUMET_API_URL?.replace(/\/$/, '');
// gogoanime or zoro (HiAnime). Zoro has the best dub coverage.
const PROVIDER = process.env.CONSUMET_PROVIDER || 'zoro';

export const isProviderEnabled = Boolean(CONSUMET_URL);

export interface ProviderSubtitle {
  url: string;
  lang: string;
}

export interface ProviderStream {
  /** Direct HLS (.m3u8) URL from the provider. */
  url: string;
  quality?: string;
  /** Referer the provider's CDN requires (passed to our HLS proxy). */
  referer?: string;
  subtitles: ProviderSubtitle[];
  dub: boolean;
}

interface ConsumetEpisode {
  id: string;
  number: number;
}

/** Look up the provider episode id for an AniList id + episode number. */
async function findEpisodeId(
  anilistId: number,
  episode: number,
  dub: boolean,
): Promise<string | null> {
  const url =
    `${CONSUMET_URL}/meta/anilist/info/${anilistId}` +
    `?provider=${PROVIDER}&dub=${dub ? 'true' : 'false'}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return null;
  const data = await res.json();
  const episodes: ConsumetEpisode[] = data?.episodes ?? [];
  const match = episodes.find((e) => Number(e.number) === episode);
  return match?.id ?? null;
}

/**
 * Resolve a playable HLS stream (+ subtitles) for an anime episode from the
 * provider. `dub` selects the English-dub variant. Returns null if unavailable
 * (e.g. no dub exists), so the caller can fall back to Real-Debrid.
 */
export async function getProviderStream(
  anilistId: number,
  episode: number,
  dub: boolean,
): Promise<ProviderStream | null> {
  if (!CONSUMET_URL) return null;
  try {
    const episodeId = await findEpisodeId(anilistId, episode, dub);
    if (!episodeId) return null;

    const watchUrl =
      `${CONSUMET_URL}/meta/anilist/watch/${encodeURIComponent(episodeId)}` +
      `?provider=${PROVIDER}`;
    const res = await fetch(watchUrl, { next: { revalidate: 900 } });
    if (!res.ok) return null;
    const data = await res.json();

    // Prefer an explicit auto/multi-quality m3u8; else the first HLS source.
    const sources: { url: string; quality?: string; isM3U8?: boolean }[] =
      data?.sources ?? [];
    const hls =
      sources.find((s) => s.quality === 'auto' || s.quality === 'default') ??
      sources.find((s) => s.isM3U8) ??
      sources[0];
    if (!hls?.url) return null;

    const subtitles: ProviderSubtitle[] = (data?.subtitles ?? [])
      .filter((s: { url?: string; lang?: string }) => s.url && s.lang)
      .map((s: { url: string; lang: string }) => ({ url: s.url, lang: s.lang }));

    return {
      url: hls.url,
      quality: hls.quality,
      referer: data?.headers?.Referer ?? data?.headers?.referer,
      subtitles,
      dub,
    };
  } catch {
    return null;
  }
}
