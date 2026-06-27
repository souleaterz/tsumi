import 'server-only';
import { HiAnime } from 'aniwatch';

// ─────────────────────────────────────────────────────────────
// Streaming-provider source resolution — HiAnime (via aniwatch npm).
//
// Why this exists: Real-Debrid streams torrents but RD evicts cached files,
// stutters under live transcoding, and torrent dubs are unreliable. HiAnime
// hosts pre-transcoded HLS with native English **sub AND dub** plus real
// English subtitles — exactly what an English-speaking audience expects.
//
// IMPORTANT — fragility:
//   • The `aniwatch` GitHub repo got DMCA'd; the npm package still installs
//     but its longevity is uncertain.
//   • HiAnime's domain/HTML changes break the scraper periodically.
//   • The whole thing is opt-in (ENABLE_HIANIME=true) and falls back to RD
//     silently on any failure, so the site keeps working even if HiAnime is
//     unreachable.
//
// Pipeline:
//   AniList id ─search HiAnime─▶ HiAnime anime id (cached forever per anilistId)
//              ─getEpisodes──▶  episode id for the requested number
//              ─getEpisodeSources("sub"|"dub")──▶  HLS m3u8 + English subs
//   HLS routes through /api/hls (CORS + injects HiAnime's required Referer).
// ─────────────────────────────────────────────────────────────

const ENABLED = process.env.ENABLE_HIANIME === 'true';
export const isProviderEnabled = ENABLED;

let scraper: HiAnime.Scraper | null = null;
function getScraper(): HiAnime.Scraper {
  if (!scraper) scraper = new HiAnime.Scraper();
  return scraper;
}

// AniList id → HiAnime slug. Cached per-process; lookups are expensive
// (search + getInfo) but the mapping never changes for a given show.
const anilistToHianime = new Map<number, string | null>();

export interface ProviderSubtitle {
  url: string;
  lang: string;
}

export interface ProviderStream {
  /** HLS .m3u8 URL the player can fetch (through our /api/hls proxy). */
  url: string;
  quality?: string;
  /** Referer the HiAnime CDN requires (handed to the HLS proxy). */
  referer?: string;
  subtitles: ProviderSubtitle[];
  dub: boolean;
}

/** Find HiAnime's anime slug for a given AniList id. */
async function resolveHianimeSlug(
  anilistId: number,
  title: string,
): Promise<string | null> {
  if (anilistToHianime.has(anilistId)) return anilistToHianime.get(anilistId)!;
  const hianime = getScraper();

  // 1. Search HiAnime by title. Search results don't include anilistId, so we
  //    have to verify candidates via getInfo until one matches.
  try {
    const searchRes = await hianime.search(title, 1);
    const candidates = (searchRes.animes ?? []).filter((a) => a.id).slice(0, 5);

    for (const cand of candidates) {
      if (!cand.id) continue;
      try {
        const info = await hianime.getInfo(cand.id);
        if (info?.anime?.info?.anilistId === anilistId) {
          anilistToHianime.set(anilistId, cand.id);
          return cand.id;
        }
      } catch {
        /* try next candidate */
      }
    }
  } catch {
    /* search failed entirely — HiAnime may be down */
  }
  anilistToHianime.set(anilistId, null);
  return null;
}

/** Fetch a playable HLS stream + English subtitles for an episode. */
export async function getProviderStream(
  anilistId: number,
  episode: number,
  dub: boolean,
  titleHint?: string,
): Promise<ProviderStream | null> {
  if (!ENABLED) return null;
  if (!titleHint) return null;

  const hianime = getScraper();
  const slug = await resolveHianimeSlug(anilistId, titleHint);
  if (!slug) return null;

  try {
    // 2. Episode list → find the requested episode number.
    const eps = await hianime.getEpisodes(slug);
    const epMatch = eps.episodes?.find((e) => e?.number === episode);
    if (!epMatch?.episodeId) return null;

    // 3. Sources for sub OR dub. `hd-1` is HiAnime's default high-quality server.
    const src = await hianime.getEpisodeSources(
      epMatch.episodeId,
      'hd-1',
      dub ? 'dub' : 'sub',
    );

    const m3u8 =
      src.sources?.find((s) => s.isM3U8) ?? src.sources?.[0];
    if (!m3u8?.url) return null;

    // Keep only English-language subtitle tracks (this is an English-first app).
    const subs: ProviderSubtitle[] = (src.subtitles ?? [])
      .filter((s) => s?.url && /english|^en\b/i.test(s.lang ?? ''))
      .map((s) => ({ url: s.url, lang: s.lang || 'English' }));

    return {
      url: m3u8.url,
      quality: m3u8.quality,
      referer: src.headers?.Referer ?? src.headers?.referer,
      subtitles: subs,
      dub,
    };
  } catch {
    // Scraper broke, or HiAnime returned an error — fall back silently.
    return null;
  }
}
