import 'server-only';

// ─────────────────────────────────────────────────────────────
// External subtitle lookup via Jimaku (https://jimaku.cc).
//
// Anime-specific subtitle archive, keyed by AniList id. Requires a free API
// key (jimaku.cc → Account → API key) set as JIMAKU_API_KEY. Without one,
// `getEpisodeSubs` returns []. Subtitle files (mostly .srt/.ass) are cloud-
// hosted without CORS, so the watch page routes them through /api/sub.
// ─────────────────────────────────────────────────────────────

const JIMAKU_KEY = process.env.JIMAKU_API_KEY;
const JIMAKU_BASE = 'https://jimaku.cc/api';

export const isJimakuEnabled = Boolean(JIMAKU_KEY);

export interface ExternalSub {
  /** Original (Jimaku-hosted) file URL — must be proxied for CORS. */
  url: string;
  filename: string;
  /** Human label e.g. "English" / "English (signs only)". */
  lang: string;
  ext: 'vtt' | 'srt' | 'ass' | 'ssa';
}

interface JimakuEntry {
  id: number;
  name: string;
  english_name?: string;
  anilist_id?: number;
}

interface JimakuFile {
  name: string;
  url: string;
  size?: number;
}

const VALID_EXT = /\.(vtt|srt|ass|ssa)$/i;

/** Does this filename plausibly belong to `episode`? */
function fileMatchesEpisode(filename: string, episode: number): boolean {
  const n = String(episode);
  const padded = n.padStart(2, '0');
  // Patterns: S01E12 / E12 / "- 12" / " 12 " / Episode 12 / Ep12
  const re = new RegExp(
    `(?:^|[\\s\\-_\\[#(])(?:e|ep|episode)?\\s*0*${n}(?:$|[\\s\\-_v\\].)\\[])`,
    'i',
  );
  if (re.test(filename)) return true;
  return filename.includes(` ${padded} `) || filename.includes(`-${padded}.`);
}

/**
 * Look up external subtitle files for an AniList episode on Jimaku.
 * Filters to English-likely VTT/SRT/ASS files for this exact episode, ranked
 * by file format (VTT preferred — browser-native; SRT next; ASS works via
 * libass but quality varies; we still include it so the player has something).
 */
export async function getEpisodeSubs(
  anilistId: number,
  episode: number,
): Promise<ExternalSub[]> {
  if (!JIMAKU_KEY) return [];
  try {
    const headers = { Authorization: JIMAKU_KEY };

    // 1. Find Jimaku entries for this AniList id (often >1 for multi-season).
    const entriesRes = await fetch(
      `${JIMAKU_BASE}/entries/search?anilist_id=${anilistId}`,
      { headers, next: { revalidate: 86400 } },
    );
    if (!entriesRes.ok) return [];
    const entries = (await entriesRes.json()) as JimakuEntry[];
    if (!entries?.length) return [];

    // 2. Pull files for the most relevant entries (cap at 3 to limit API calls).
    const fileLists = await Promise.all(
      entries.slice(0, 3).map((e) =>
        fetch(`${JIMAKU_BASE}/entries/${e.id}/files`, {
          headers,
          next: { revalidate: 3600 },
        })
          .then((r) => (r.ok ? (r.json() as Promise<JimakuFile[]>) : []))
          .catch(() => [] as JimakuFile[]),
      ),
    );
    const files = fileLists.flat();

    // 3. Filter to subtitle files matching this episode + drop archives.
    const matches = files.filter((f) => {
      if (!f?.name || !f?.url) return false;
      if (!VALID_EXT.test(f.name)) return false; // skip .zip/.rar etc.
      return fileMatchesEpisode(f.name, episode);
    });

    // 4. Rank by extension preference (VTT > SRT > ASS) and dedupe by url.
    const extRank: Record<string, number> = { vtt: 4, srt: 3, ass: 2, ssa: 1 };
    const seen = new Set<string>();
    return matches
      .map((f): ExternalSub => {
        const ext = (f.name.split('.').pop() || '').toLowerCase() as ExternalSub['ext'];
        return {
          url: f.url,
          filename: f.name,
          lang: 'English',
          ext,
        };
      })
      .filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)))
      .sort((a, b) => (extRank[b.ext] ?? 0) - (extRank[a.ext] ?? 0))
      .slice(0, 4);
  } catch {
    return [];
  }
}
