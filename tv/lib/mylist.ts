'use client';

// "My list" for the TV app. Backed by localStorage today so the feature works
// with zero setup; once device-code pairing lands it will sync to the signed-in
// user's Supabase watchlist (same shape as the website's lib/watchlist.ts).

export interface MyListItem {
  id: number;
  title: string;
  cover?: string;
}

const KEY = 'tsumi.tv.mylist';
const EVENT = 'tsumi-mylist-change';

function read(): MyListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MyListItem[]) : [];
  } catch {
    return [];
  }
}

function write(list: MyListItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function getMyList(): MyListItem[] {
  return read();
}

export function isInList(id: number): boolean {
  return read().some((m) => m.id === id);
}

/** Add or remove; returns the new membership state (true = now in the list). */
export function toggleMyList(item: MyListItem): boolean {
  const list = read();
  const idx = list.findIndex((m) => m.id === item.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(list);
    return false;
  }
  list.unshift(item);
  write(list);
  return true;
}

/** Subscribe to list changes (mutations here + other tabs). */
export function subscribeMyList(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => cb();
  window.addEventListener(EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
