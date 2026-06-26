// ─────────────────────────────────────────────────────────────
// Stream source resolution.
//
// Preferred path (works in-browser on Vercel):
//   AniList ID ─Anizip→ Kitsu id ─Torrentio+RealDebrid→ direct HTTPS stream URL
//   → Vidstack plays it natively. No WebTorrent / WebRTC needed.
//
// Fallback path (only when no REALDEBRID_API_KEY is set):
//   Torrentio/Nyaa magnets → WebTorrent in the browser. NOTE: this only works
//   for swarms with WebRTC peers, so it won't play most public torrents — set a
//   Real-Debrid key for reliable playback.
// ─────────────────────────────────────────────────────────────

const TORRENTIO_BASE =
  process.env.NEXT_PUBLIC_TORRENTIO_BASE || 'https://torrentio.strem.fun';
const ANIZIP_BASE = process.env.NEXT_PUBLIC_ANIZIP_BASE || 'https://api.ani.zip';
const NYAA_BASE = process.env.NEXT_PUBLIC_NYAA_BASE || 'https://nyaa.si';
const RD_API_KEY = process.env.REALDEBRID_API_KEY;

export const isDebridEnabled = Boolean(RD_API_KEY);

export interface EpisodeMeta {
  /** Entry-local episode number — what Torrentio/Kitsu streams key off. */
  episode: number;
  /** TVDB season number (via Anizip), for grouping into real seasons. */
  seasonNumber?: number;
  /** In-season episode number (resets each season), for display. */
  episodeNumber?: number;
  title?: string;
  image?: string;
  overview?: string;
  airdate?: string;
}

export interface StreamSource {
  title: string;
  quality?: string;
  seeders?: number;
  size?: string;
  source?: string;
  cached?: boolean;
  /** WebTorrent fallback fields (no-debrid mode). */
  infoHash?: string;
  magnet?: string;
  /**
   * Real-Debrid mode: the Torrentio resolver URL. SERVER-ONLY — it embeds the
   * RD API key, so it must be stripped before sending sources to the client
   * (the watch page replaces it with a keyless /api/stream-url endpoint).
   */
  url?: string;
  /**
   * Client-safe playback URL (our /api/stream-url endpoint). Present on RD
   * sources after the watch page sanitises them; the player plays it directly.
   */
  playUrl?: string;
  /** True when the release carries an English dub (incl. dual/multi-audio). */
  dub?: boolean;
}

/** Detect a dub-capable release from its name (dual/multi-audio counts). */
function parseDub(title: string): boolean {
  return /dual.?audio|multi.?audio|multi.?sub.?dub|\bdubbed?\b|\beng(?:lish)?.?dub\b/i.test(
    title,
  );
}

/** Build a magnet URI from a Torrentio infoHash with sensible public trackers. */
function buildMagnet(infoHash: string, name: string): string {
  const trackers = [
    'udp://tracker.opentrackr.org:1337/announce',
    'udp://open.demonii.com:1337/announce',
    'udp://tracker.openbittorrent.com:6969/announce',
    'udp://exodus.desync.com:6969/announce',
  ];
  const tr = trackers.map((t) => `&tr=${encodeURIComponent(t)}`).join('');
  return `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}${tr}`;
}

/** Parse quality (1080p/720p/etc.) out of a release title. */
function parseQuality(title: string): string | undefined {
  const m = title.match(/(2160p|1080p|720p|480p)/i);
  return m ? m[1].toLowerCase() : undefined;
}

/** Parse "👤 12" seeders and "💾 1.3 GB" size out of Torrentio's title blob. */
function parseTorrentioMeta(title: string): { seeders?: number; size?: string } {
  const seedM = title.match(/👤\s*(\d+)/);
  const sizeM = title.match(/💾\s*([\d.]+\s*[KMGT]B)/i);
  return {
    seeders: seedM ? Number(seedM[1]) : undefined,
    size: sizeM ? sizeM[1] : undefined,
  };
}

/**
 * Fetch episode metadata (titles, thumbnails) for an AniList ID via Anizip.
 * Returns an empty list on failure so the UI can fall back to numeric episodes.
 */
export async function getEpisodeMeta(anilistId: number): Promise<EpisodeMeta[]> {
  try {
    const res = await fetch(`${ANIZIP_BASE}/mappings?anilist_id=${anilistId}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const episodes = data?.episodes ?? {};
    return Object.entries(episodes)
      .map(([num, ep]) => {
        const e = ep as Record<string, unknown>;
        return {
          episode: Number(num),
          seasonNumber:
            typeof e.seasonNumber === 'number' ? e.seasonNumber : undefined,
          episodeNumber:
            typeof e.episodeNumber === 'number' ? e.episodeNumber : undefined,
          title:
            (e.title as Record<string, string>)?.en ||
            (e.title as Record<string, string>)?.['x-jat'],
          image: e.image as string | undefined,
          overview: e.overview as string | undefined,
          airdate: e.airDate as string | undefined,
        };
      })
      .filter((e) => Number.isFinite(e.episode) && e.episode > 0)
      .sort((a, b) => a.episode - b.episode);
  } catch {
    return [];
  }
}

/** Map an AniList ID to its MAL ID (Torrentio keys off MAL/IMDB style ids via Kitsu). */
export async function getMalId(anilistId: number): Promise<number | null> {
  try {
    const res = await fetch(`${ANIZIP_BASE}/mappings?anilist_id=${anilistId}`, {
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.mappings?.mal_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Rank sources for the best *fast* experience:
 *   1. Real-Debrid cached torrents first (instant — no waiting for RD download).
 *   2. 1080p preferred over everything (4K is huge/slow to transcode; 720p lower).
 *   3. Most seeders (faster to fetch/cache).
 * So the default selected source is the cached 1080p with the most seeds.
 */
function rankSources(streams: StreamSource[]): StreamSource[] {
  // 1080p is the sweet spot; 4K is demoted below 1080p/720p for speed.
  const qRank: Record<string, number> = { '1080p': 4, '720p': 3, '2160p': 2, '480p': 1 };
  return [...streams].sort((a, b) => {
    if (a.cached !== b.cached) return a.cached ? -1 : 1;
    const q = (qRank[b.quality ?? ''] ?? 0) - (qRank[a.quality ?? ''] ?? 0);
    if (q !== 0) return q;
    return (b.seeders ?? 0) - (a.seeders ?? 0);
  });
}

/**
 * Fetch Torrentio sources for a Kitsu id + episode.
 *
 * With a Real-Debrid key configured, the config segment `realdebrid=<key>` makes
 * Torrentio return playable HTTPS resolver URLs (cached torrents) instead of
 * magnets — these stream natively in the browser. Otherwise it returns magnets
 * for the WebTorrent fallback.
 */
async function resolveTorrentio(
  anilistId: number,
  episode: number,
): Promise<StreamSource[]> {
  const mapRes = await fetch(`${ANIZIP_BASE}/mappings?anilist_id=${anilistId}`, {
    next: { revalidate: 86400 },
  });
  if (!mapRes.ok) return [];
  const map = await mapRes.json();
  const kitsuId: number | undefined = map?.mappings?.kitsu_id;
  if (!kitsuId) return [];

  // Insert the debrid config segment when a key is present.
  const config = RD_API_KEY ? `/realdebrid=${RD_API_KEY}` : '';
  const url = `${TORRENTIO_BASE}${config}/stream/series/kitsu:${kitsuId}:${episode}.json`;
  // Don't cache the RD variant publicly — the URL embeds the secret key.
  const res = await fetch(url, RD_API_KEY ? { cache: 'no-store' } : { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = await res.json();

  return (data?.streams ?? [])
    .map((s: Record<string, unknown>) => {
      const name = String(s.name ?? '');
      const fullTitle = `${name} ${s.title ?? ''}`.trim();
      const meta = parseTorrentioMeta(String(s.title ?? ''));
      // Torrentio marks Real-Debrid cached torrents with "RD+"/⚡ in the name.
      const cached = /RD\+|⚡/.test(name);
      const dub = parseDub(fullTitle);

      if (s.url) {
        // Real-Debrid mode: a directly-resolvable stream URL.
        return {
          title: String(s.title ?? name ?? 'Source'),
          url: String(s.url),
          quality: parseQuality(fullTitle),
          seeders: meta.seeders,
          size: meta.size,
          cached,
          dub,
          source: 'Real-Debrid',
        } as StreamSource;
      }
      if (s.infoHash) {
        // Magnet (WebTorrent fallback) mode.
        const infoHash = String(s.infoHash);
        return {
          title: String(s.title ?? name ?? 'Source'),
          infoHash,
          magnet: buildMagnet(infoHash, String(s.title ?? 'episode')),
          quality: parseQuality(fullTitle),
          seeders: meta.seeders,
          size: meta.size,
          dub,
          source: 'Torrentio',
        } as StreamSource;
      }
      return null;
    })
    .filter((s: StreamSource | null): s is StreamSource => s !== null);
}

/** Does a release title plausibly contain this episode number? */
function matchesEpisode(title: string, episode: number): boolean {
  const ep = String(episode);
  const padded = ep.padStart(2, '0');
  // " - 12", "E12", "#12", " 12 ", "[12]", "Ep12" etc.
  const re = new RegExp(
    `(?:^|[\\s\\-_\\[#(]|ep|episode|e)0*${ep}(?:$|[\\s\\-_v\\].)])`,
    'i',
  );
  return re.test(title) || title.includes(` ${padded} `);
}

/** Pull `<nyaa:foo>` / `<tag>` values out of an RSS <item> blob. */
function rssField(item: string, tag: string): string | undefined {
  // `s` (dotAll) lets `.` span any tag content without \s\S escaping.
  const m = item.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 'is'));
  if (!m) return undefined;
  return m[1]
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

/**
 * Fallback resolver: Nyaa.si English-translated anime RSS, searched by title +
 * episode. Only used when Torrentio returns nothing. Filters to releases whose
 * title plausibly matches the episode, then ranks by quality/seeders.
 */
export async function resolveNyaa(
  title: string,
  episode: number,
): Promise<StreamSource[]> {
  if (!title) return [];
  try {
    const padded = String(episode).padStart(2, '0');
    const q = encodeURIComponent(`${title} ${padded}`);
    // c=1_2 → "Anime - English-translated"; sorted by seeders desc.
    const url = `${NYAA_BASE}/?page=rss&q=${q}&c=1_2&f=0&s=seeders&o=desc`;
    const res = await fetch(url, { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const xml = await res.text();

    const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
    const sources: StreamSource[] = [];
    for (const item of items) {
      const name = rssField(item, 'title');
      const infoHash = rssField(item, 'nyaa:infoHash');
      if (!name || !infoHash) continue;
      // Skip obvious batches/season packs and episode mismatches.
      if (/\bbatch\b|\bcomplete\b|\bseason\b/i.test(name)) continue;
      if (!matchesEpisode(name, episode)) continue;

      sources.push({
        title: name,
        infoHash,
        magnet: buildMagnet(infoHash, name),
        quality: parseQuality(name),
        seeders: Number(rssField(item, 'nyaa:seeders')) || undefined,
        size: rssField(item, 'nyaa:size'),
        dub: parseDub(name),
        source: 'Nyaa',
      });
      if (sources.length >= 15) break;
    }
    return sources;
  } catch {
    return [];
  }
}

/**
 * Resolve stream sources for an anime episode. Tries Torrentio first
 * (AniList→Kitsu via Anizip). In WebTorrent (no-debrid) mode, falls back to
 * Nyaa RSS when a `title` is supplied and Torrentio yields nothing — the Nyaa
 * fallback is skipped under Real-Debrid since its magnets aren't RD-resolved.
 */
export async function resolveStreams(
  anilistId: number,
  episode: number,
  title?: string,
): Promise<StreamSource[]> {
  try {
    const torrentio = await resolveTorrentio(anilistId, episode);
    if (torrentio.length > 0) return rankSources(torrentio);

    if (title && !isDebridEnabled) {
      const nyaa = await resolveNyaa(title, episode);
      if (nyaa.length > 0) return rankSources(nyaa);
    }
    return [];
  } catch {
    return [];
  }
}

const RD_BASE = 'https://api.real-debrid.com/rest/1.0';

// Containers browsers can decode natively — play these directly, no transcode.
const BROWSER_CONTAINER = /\.(mp4|m4v|webm|mov)(\?|$)/i;

export interface PlayableStream {
  /** The URL to play. */
  url: string;
  /** True when `url` is an HLS (.m3u8) playlist needing hls.js. */
  hls: boolean;
  /** Progressive-MP4 transcode to fall back to if HLS fails (e.g. CORS). */
  mp4Fallback?: string;
}

/**
 * Resolve a single source's final, directly-playable stream URL by following
 * the Torrentio Real-Debrid resolver redirect SERVER-SIDE. Returns a keyless
 * RD CDN URL safe to hand to the browser, or null on failure.
 */
export async function resolveFinalUrl(resolverUrl: string): Promise<string | null> {
  try {
    // The resolver 302-redirects to the unrestricted Real-Debrid link.
    const res = await fetch(resolverUrl, { redirect: 'manual', cache: 'no-store' });
    const location = res.headers.get('location');
    if (location) return location;
    // Some resolvers answer 200 with the URL already final.
    if (res.ok && res.url && res.url !== resolverUrl) return res.url;
    return null;
  } catch {
    return null;
  }
}

/** Recursively find the first string value in `obj` matching `re`. */
function deepFindUrl(obj: unknown, re: RegExp): string | null {
  if (typeof obj === 'string') return re.test(obj) ? obj : null;
  if (obj && typeof obj === 'object') {
    for (const v of Object.values(obj)) {
      const r = deepFindUrl(v, re);
      if (r) return r;
    }
  }
  return null;
}

/**
 * Turn a Torrentio Real-Debrid resolver URL into something the browser can
 * actually play. `.mp4`/`.webm` files stream directly; `.mkv` and other
 * non-browser containers are transcoded by Real-Debrid to HLS (with a
 * progressive-MP4 fallback) so they play without WebTorrent.
 */
export async function resolvePlayable(
  resolverUrl: string,
): Promise<PlayableStream | null> {
  const finalUrl = await resolveFinalUrl(resolverUrl);
  if (!finalUrl) return null;

  // Already a browser-playable container — stream it as-is.
  if (BROWSER_CONTAINER.test(finalUrl)) return { url: finalUrl, hls: false };

  // Otherwise ask Real-Debrid to transcode it. The download id is the `/d/<id>/`
  // segment of the unrestricted link.
  const id = finalUrl.match(/\/d\/([^/]+)/)?.[1];
  if (!RD_API_KEY || !id) return { url: finalUrl, hls: false };

  try {
    const res = await fetch(`${RD_BASE}/streaming/transcode/${id}`, {
      headers: { Authorization: `Bearer ${RD_API_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) return { url: finalUrl, hls: false };
    const t = await res.json();
    const hls = deepFindUrl(t?.apple, /\.m3u8/i);
    const mp4 = deepFindUrl(t?.liveMP4, /^https?:/i);
    if (hls) return { url: hls, hls: true, mp4Fallback: mp4 ?? undefined };
    if (mp4) return { url: mp4, hls: false };
    return { url: finalUrl, hls: false };
  } catch {
    return { url: finalUrl, hls: false };
  }
}
