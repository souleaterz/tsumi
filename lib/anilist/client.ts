import type { AnilistMedia, MediaSeason, PageInfo } from './types';
import {
  DETAIL_QUERY,
  GENRES_QUERY,
  POPULAR_QUERY,
  SEARCH_QUERY,
  SEASONAL_QUERY,
  TRENDING_QUERY,
} from './queries';

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

export async function getGenres(): Promise<string[]> {
  const data = await anilistFetch<{ GenreCollection: string[] }>(
    GENRES_QUERY,
    {},
    86400,
  );
  // AniList includes a couple of NSFW-adjacent buckets we hide from filters.
  return data.GenreCollection.filter((g) => g !== 'Hentai');
}
