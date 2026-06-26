import type { AnilistMedia, MediaSeason, PageInfo } from './types';
import {
  DETAIL_QUERY,
  GENRES_QUERY,
  POPULAR_QUERY,
  RECS_QUERY,
  SEARCH_QUERY,
  SEASONAL_QUERY,
  SUGGEST_QUERY,
  SUGGEST_BY_IDS_QUERY,
  TITLE_INDEX_QUERY,
  TRENDING_QUERY,
} from './queries';
import { fuzzyMatch, type TitleEntry } from './fuzzy';

export interface SearchSuggestion {
  id: number;
  title: { romaji?: string | null; english?: string | null };
  coverImage?: { medium?: string | null; color?: string | null };
  format?: string | null;
  seasonYear?: number | null;
  averageScore?: number | null;
}

const ENDPOINT =
  process.env.NEXT_PUBLIC_ANILIST_ENDPOINT || 'https://graphql.anilist.co';

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

/**
 * Core AniList fetcher. Uses Next.js fetch caching with revalidation so the
 * homepage stays fast while data refreshes server-side every 30 minutes.
 *
 * A hard request timeout (via AbortController) guarantees a stalled connection
 * can never hang a build or request. AniList enforces ~90 req/min and replies
 * with 429 + Retry-After when throttled — we honour that with a single retry.
 */
export async function anilistFetch<T>(
  query: string,
  variables: Record<string, unknown> = {},
  revalidate = 1800,
  attempt = 0,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      next: { revalidate },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  // Respect rate limiting: back off once on 429 (Retry-After is in seconds).
  if (res.status === 429 && attempt < 1) {
    const retryAfter = Number(res.headers.get('Retry-After')) || 2;
    await new Promise((r) => setTimeout(r, Math.min(retryAfter, 10) * 1000));
    return anilistFetch<T>(query, variables, revalidate, attempt + 1);
  }

  if (!res.ok) {
    throw new Error(`AniList request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`AniList error: ${json.errors.map((e) => e.message).join(', ')}`);
  }
  if (!json.data) {
    throw new Error('AniList returned no data');
  }
  return json.data;
}

/** Determine the current anime season for seasonal queries. */
export function currentSeason(): { season: MediaSeason; year: number } {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  const year = now.getFullYear();
  let season: MediaSeason;
  if (month <= 1 || month === 11) season = 'WINTER';
  else if (month <= 4) season = 'SPRING';
  else if (month <= 7) season = 'SUMMER';
  else season = 'FALL';
  // December rolls into the next winter season year.
  return { season, year: month === 11 ? year + 1 : year };
}

export async function getTrending(perPage = 24): Promise<AnilistMedia[]> {
  const data = await anilistFetch<{ Page: { media: AnilistMedia[] } }>(
    TRENDING_QUERY,
    { perPage },
  );
  return data.Page.media;
}

export async function getSeasonal(perPage = 18): Promise<AnilistMedia[]> {
  const { season, year } = currentSeason();
  const data = await anilistFetch<{ Page: { media: AnilistMedia[] } }>(
    SEASONAL_QUERY,
    { season, seasonYear: year, perPage },
  );
  return data.Page.media;
}

export async function getPopular(perPage = 12): Promise<AnilistMedia[]> {
  const data = await anilistFetch<{ Page: { media: AnilistMedia[] } }>(
    POPULAR_QUERY,
    { perPage },
  );
  return data.Page.media;
}

export async function getAnimeDetail(id: number): Promise<AnilistMedia | null> {
  try {
    const data = await anilistFetch<{ Media: AnilistMedia }>(DETAIL_QUERY, { id });
    return data.Media;
  } catch {
    return null;
  }
}

export interface SearchResult {
  media: AnilistMedia[];
  pageInfo: PageInfo;
}

export async function searchAnime(variables: {
  search?: string;
  genre?: string;
  seasonYear?: number;
  format?: string;
  status?: string;
  sort?: string[];
  page?: number;
  perPage?: number;
}): Promise<SearchResult> {
  // Drop empty values so AniList doesn't choke on null enums.
  const cleaned = Object.fromEntries(
    Object.entries(variables).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  );
  if (!cleaned.sort) cleaned.sort = ['POPULARITY_DESC'];
  const data = await anilistFetch<{
    Page: { pageInfo: PageInfo; media: AnilistMedia[] };
  }>(SEARCH_QUERY, cleaned, 300);
  return { media: data.Page.media, pageInfo: data.Page.pageInfo };
}

/** Cached index of popular anime titles (~250) for fuzzy typo correction. */
async function getTitleIndex(): Promise<TitleEntry[]> {
  const pages = [1, 2, 3, 4, 5];
  const results = await Promise.all(
    pages.map((page) =>
      anilistFetch<{ Page: { media: TitleEntry[] } }>(
        TITLE_INDEX_QUERY,
        { page, perPage: 50 },
        86400,
      ).then((d) => d.Page.media).catch(() => []),
    ),
  );
  return results.flat();
}

export async function searchSuggestions(query: string): Promise<SearchSuggestion[]> {
  if (!query.trim()) return [];
  try {
    const data = await anilistFetch<{ Page: { media: SearchSuggestion[] } }>(
      SUGGEST_QUERY,
      { search: query, perPage: 8 },
      300,
    );
    if (data.Page.media.length > 0) return data.Page.media;

    // Nothing matched exactly — try fuzzy "did you mean" against popular titles.
    const index = await getTitleIndex();
    const ids = fuzzyMatch(query, index);
    if (ids.length === 0) return [];
    const byIds = await anilistFetch<{ Page: { media: SearchSuggestion[] } }>(
      SUGGEST_BY_IDS_QUERY,
      { ids },
      300,
    );
    // Preserve fuzzy ranking order.
    const order = new Map(ids.map((id, i) => [id, i]));
    return byIds.Page.media.sort(
      (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
    );
  } catch {
    return [];
  }
}

/**
 * Aggregate "because you watched" recommendations from a set of seed anime ids
 * (the user's history/watchlist). Dedupes, drops the seeds themselves, and
 * ranks by how often a title is recommended, then score.
 */
export async function getRecommendationsFor(
  ids: number[],
  limit = 18,
): Promise<AnilistMedia[]> {
  const seeds = ids.slice(0, 6);
  if (seeds.length === 0) return [];
  try {
    const data = await anilistFetch<{
      Page: {
        media: { recommendations: { nodes: { mediaRecommendation: AnilistMedia | null }[] } }[];
      };
    }>(RECS_QUERY, { ids: seeds, perPage: seeds.length }, 600);

    const seedSet = new Set(ids);
    const scored = new Map<number, { media: AnilistMedia; count: number }>();
    for (const m of data.Page.media) {
      for (const node of m.recommendations?.nodes ?? []) {
        const rec = node.mediaRecommendation;
        if (!rec || seedSet.has(rec.id)) continue;
        const existing = scored.get(rec.id);
        if (existing) existing.count += 1;
        else scored.set(rec.id, { media: rec, count: 1 });
      }
    }

    return Array.from(scored.values())
      .sort((a, b) => b.count - a.count || (b.media.averageScore ?? 0) - (a.media.averageScore ?? 0))
      .slice(0, limit)
      .map((s) => s.media);
  } catch {
    return [];
  }
}

export async function getGenres(): Promise<string[]> {
  const data = await anilistFetch<{ GenreCollection: string[] }>(
    GENRES_QUERY,
    {},
    86400,
  );
  // AniList includes a couple of NSFW-adjacent buckets we hide from filters.
  return data.GenreCollection.filter((g) => g !== 'Hentai');
}
