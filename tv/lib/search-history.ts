'use client';

// Recent search terms for the TV search page. Local to the device (localStorage);
// deliberately not synced — search history is per-TV context.

const KEY = 'tsumi.tv.searches';
const MAX = 12;

export function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    /* ignore */
  }
}

/** Record a term the user actually searched with (moves it to the front). */
export function pushSearch(q: string) {
  const term = q.trim();
  if (term.length < 2) return;
  const list = getRecentSearches().filter((x) => x.toLowerCase() !== term.toLowerCase());
  list.unshift(term);
  write(list);
}

export function removeSearch(q: string) {
  write(getRecentSearches().filter((x) => x !== q));
}

export function clearSearches() {
  write([]);
}
