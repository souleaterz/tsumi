import 'server-only';

// ─────────────────────────────────────────────────────────────
// English-only subtitle fetcher (OpenSubtitles REST API).
//
// Tsumi is an English-first site, so we only ever request English subs.
// Gated behind two env vars:
//   • OPENSUBTITLES_API_KEY — free from https://opensubtitles.com/consumers
//   • OPENSUBTITLES_USER_AGENT — required by their API ("MyApp/1.0").
// Without both, getEpisodeSubs returns [] and subtitles fall back to whatever
// the HLS stream itself carries (RD-transcoded HLS surfaces embedded mkv subs
// via Vidstack's CC menu automatically).
// ─────────────────────────────────────────────────────────────

const OS_KEY = process.env.OPENSUBTITLES_API_KEY;
const OS_UA = process.env.OPENSUBTITLES_USER_AGENT || 'Tsumi/1.0';
const OS_BASE = 'https://api.opensubtitles.com/api/v1';

export const isSubsEnabled = Boolean(OS_KEY);

export interface ExternalSub {
  url: string;
  filename: string;
  /** ISO-639 language tag — always "en" for what we return. */
  lang: string;
  ext: 'vtt' | 'srt';
}

interface OpenSubAttrs {
  language: string;
  release: string;
  files?: { file_id: number; file_name?: string }[];
}
interface OpenSubItem {
  attributes: OpenSubAttrs;
}
interface DownloadResponse {
  link: string;
  file_name?: string;
}

/**
 * Look up English subtitles for an anime episode on OpenSubtitles.
 * We search by AniList-derived title + episode number (their anime coverage
 * via IMDB id is patchy, but plain-text search works decently for anime).
 */
export async function getEpisodeSubs(
  title: string,
  episode: number,
): Promise<ExternalSub[]> {
  if (!OS_KEY || !title) return [];
  try {
    const headers = {
      'Api-Key': OS_KEY,
      'Content-Type': 'application/json',
      'User-Agent': OS_UA,
    };

    // 1. Search English subs for this title + episode.
    const search = new URLSearchParams({
      query: title,
      episode_number: String(episode),
      languages: 'en',
      type: 'episode',
    });
    const res = await fetch(`${OS_BASE}/subtitles?${search}`, {
      headers,
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items: OpenSubItem[] = data?.data ?? [];

    // 2. Keep the top 3 English results and grab the first file_id from each.
    const candidates = items
      .filter((s) => s.attributes?.language?.toLowerCase().startsWith('en'))
      .slice(0, 3);

    const subs: ExternalSub[] = [];
    for (const c of candidates) {
      const fileId = c.attributes.files?.[0]?.file_id;
      if (!fileId) continue;
      // 3. Resolve the actual download URL.
      try {
        const dl = await fetch(`${OS_BASE}/download`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ file_id: fileId }),
        });
        if (!dl.ok) continue;
        const data: DownloadResponse = await dl.json();
        if (!data?.link) continue;
        const filename = data.file_name || c.attributes.files?.[0]?.file_name || 'subs.srt';
        const ext = (filename.split('.').pop() || 'srt').toLowerCase() as ExternalSub['ext'];
        subs.push({
          url: data.link,
          filename,
          lang: 'en',
          ext: ext === 'vtt' ? 'vtt' : 'srt',
        });
      } catch {
        /* skip this one */
      }
    }
    return subs;
  } catch {
    return [];
  }
}
