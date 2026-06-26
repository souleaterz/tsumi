export interface TitleEntry {
  id: number;
  title: { romaji?: string | null; english?: string | null };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance. */
function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Similarity of `query` to one candidate title (0–1), tolerant of typos. */
function score(query: string, candidate: string): number {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (c.includes(q)) return 0.95; // clean substring (AniList already covers this)

  // Compare against the prefix of the title closest to the query's length,
  // so "demon slyer" matches the start of "demon slayer kimetsu no yaiba".
  const window = c.slice(0, Math.min(c.length, q.length + 4));
  const dist = lev(q, window);
  const sim = 1 - dist / Math.max(q.length, window.length);
  return sim;
}

/**
 * Fuzzy "did you mean": rank the title index against a (possibly misspelled)
 * query and return the closest matching ids. Used only when AniList's exact
 * search returns nothing.
 */
export function fuzzyMatch(query: string, index: TitleEntry[], limit = 8): number[] {
  const scored = index
    .map((e) => ({
      id: e.id,
      s: Math.max(
        e.title.romaji ? score(query, e.title.romaji) : 0,
        e.title.english ? score(query, e.title.english) : 0,
      ),
    }))
    .filter((x) => x.s >= 0.6)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit);
  return scored.map((x) => x.id);
}
