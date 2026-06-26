import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Strip AniList's HTML tags out of synopsis/description strings. */
export function stripHtml(html?: string | null): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Truncate text to a max length on a word boundary. */
export function truncate(text: string, max = 180): string {
  if (text.length <= max) return text;
  return text.slice(0, text.lastIndexOf(' ', max)).trimEnd() + '…';
}

/** AniList scores come back 0–100; render as a 0–10 rating. */
export function formatScore(score?: number | null): string {
  if (!score) return '—';
  return (score / 10).toFixed(1);
}

/** "TV", "MOVIE", "ONA" → "TV", "Movie", "ONA" */
export function formatFormat(format?: string | null): string {
  if (!format) return '';
  const map: Record<string, string> = {
    TV: 'TV',
    TV_SHORT: 'TV Short',
    MOVIE: 'Movie',
    SPECIAL: 'Special',
    OVA: 'OVA',
    ONA: 'ONA',
    MUSIC: 'Music',
  };
  return map[format] ?? format;
}

/** Pick the best available title (English preferred, falls back to romaji). */
export function bestTitle(title?: {
  english?: string | null;
  romaji?: string | null;
  native?: string | null;
}): string {
  return title?.english || title?.romaji || title?.native || 'Untitled';
}
