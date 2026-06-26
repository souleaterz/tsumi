import 'server-only';

/**
 * Resolve the best trailer video id for an anime.
 *
 * AniList stores a single trailer per title — usually the Japanese PV, which is
 * often region-locked or non-English. When a YOUTUBE_API_KEY is configured we
 * search YouTube for an embeddable, English-relevant trailer instead. Without a
 * key (or on failure) we fall back to AniList's trailer id.
 */
export async function getBestTrailerId(
  englishTitle: string | null | undefined,
  romajiTitle: string | null | undefined,
  fallbackYoutubeId?: string | null,
): Promise<string | null> {
  const key = process.env.YOUTUBE_API_KEY;
  const title = englishTitle || romajiTitle;

  if (key && title) {
    try {
      const q = encodeURIComponent(`${title} anime trailer english sub`);
      const url =
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
        `&videoEmbeddable=true&maxResults=1&relevanceLanguage=en&safeSearch=strict` +
        `&q=${q}&key=${key}`;
      const res = await fetch(url, { next: { revalidate: 604800 } });
      if (res.ok) {
        const data = await res.json();
        const vid = data?.items?.[0]?.id?.videoId;
        if (vid) return vid;
      }
    } catch {
      // fall through to the AniList trailer
    }
  }

  return fallbackYoutubeId ?? null;
}
