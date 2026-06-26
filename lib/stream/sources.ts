// ─────────────────────────────────────────────────────────────
// Stream source resolution.
//
// Flow:  AniList ID  ──Anizip──▶  MAL / mappings + episode metadata
//                    ──Torrentio──▶ magnet links per episode
//        WebTorrent streams the chosen magnet client-side in the browser.
// ─────────────────────────────────────────────────────────────

const TORRENTIO_BASE =
  process.env.NEXT_PUBLIC_TORRENTIO_BASE || 'https://torrentio.strem.fun';
const ANIZIP_BASE = process.env.NEXT_PUBLIC_ANIZIP_BASE || 'https://api.ani.zip';
const NYAA_BASE = process.env.NEXT_PUBLIC_NYAA_BASE || 'https://nyaa.si';

export interface EpisodeMeta {
  episode: number;
  title?: string;
  image?: string;
  overview?: string;
  airdate?: string;
}

export interface StreamSource {
  title: string;
  infoHash: string;
  magnet: string;
  quality?: string;
  seeders?: number;
  size?: string;
  source?: string;
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

/** Rank sources: higher quality first, then more seeders. */
function rankSources(streams: StreamSource[]): StreamSource[] {
  const qRank: Record<string, number> = { '2160p': 4, '1080p': 3, '720p': 2, '480p': 1 };
  return [...streams].sort((a, b) => {
    const q = (qRank[b.quality ?? ''] ?? 0) - (qRank[a.quality ?? ''] ?? 0);
    if (q !== 0) return q;
    return (b.seeders ?? 0) - (a.seeders ?? 0);
  });
}

/** Fetch Torrentio magnet sources for a Kitsu id + episode. */
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

  const url = `${TORRENTIO_BASE}/stream/series/kitsu:${kitsuId}:${episode}.json`;
  const res = await fetch(url, { next: { revalidate: 1800 } });
  if (!res.ok) return [];
  const data = await res.json();

  return (data?.streams ?? [])
    .filter((s: Record<string, unknown>) => s.infoHash)
    .map((s: Record<string, unknown>) => {
      const fullTitle = `${s.name ?? ''} ${s.title ?? ''}`.trim();
      const meta = parseTorrentioMeta(String(s.title ?? ''));
      const infoHash = String(s.infoHash);
      return {
        title: String(s.title ?? s.name ?? 'Source'),
        infoHash,
        magnet: buildMagnet(infoHash, String(s.title ?? 'episode')),
        quality: parseQuality(fullTitle),
        seeders: meta.seeders,
        size: meta.size,
        source: 'Torrentio',
      } as StreamSource;
    });
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
 * (AniList→Kitsu via Anizip), then falls back to Nyaa RSS when a `title`
 * is supplied and Torrentio yields nothing. Returns ranked magnet sources.
 */
export async function resolveStreams(
  anilistId: number,
  episode: number,
  title?: string,
): Promise<StreamSource[]> {
  try {
    const torrentio = await resolveTorrentio(anilistId, episode);
    if (torrentio.length > 0) return rankSources(torrentio);

    if (title) {
      const nyaa = await resolveNyaa(title, episode);
      if (nyaa.length > 0) return rankSources(nyaa);
    }
    return [];
  } catch {
    return [];
  }
}
