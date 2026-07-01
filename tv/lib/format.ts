import type { AnilistMedia } from '@shared/anilist/types';

/** Best display title for the English-first TV audience. */
export function displayTitle(media: Pick<AnilistMedia, 'title'>): string {
  return media.title.english || media.title.romaji || media.title.native || 'Untitled';
}

/** AniList descriptions contain a little HTML — strip it to plain text. */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** e.g. "TV · 2024" from format + year. */
export function formatMeta(media: Pick<AnilistMedia, 'format' | 'seasonYear'>): string {
  const bits = [media.format?.replace(/_/g, ' '), media.seasonYear].filter(Boolean);
  return bits.join(' · ');
}

/** AniList averageScore (0-100) → "8.4" style rating. */
export function ratingOf(score?: number | null): string | null {
  if (!score) return null;
  return (score / 10).toFixed(1);
}
