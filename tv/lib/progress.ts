'use client';

// Watch progress for the TV app — powers the "Continue watching" row and resume.
// Local to the device today (localStorage); the pairing flow can sync it later,
// same as My List. The native shell reports real positions via the tsumiTV
// bridge (onProgress); in a plain browser we at least record what was started.

export interface WatchProgress {
  id: number;
  ep: number;
  title: string;
  cover?: string;
  positionSec: number;
  durationSec: number;
  totalEpisodes?: number;
  updatedAt: number;
}

const KEY = 'tsumi.tv.progress';
const EVENT = 'tsumi-progress-change';
const MAX = 30;

function read(): WatchProgress[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WatchProgress[]) : [];
  } catch {
    return [];
  }
}

function write(list: WatchProgress[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

/** True once an episode is effectively finished (past 92%). */
export function isCompleted(p: Pick<WatchProgress, 'positionSec' | 'durationSec'>): boolean {
  return p.durationSec > 0 && p.positionSec / p.durationSec > 0.92;
}

/** Upsert progress for one (id, ep) — newest first. */
export function saveProgress(p: WatchProgress) {
  const list = read().filter((x) => !(x.id === p.id && x.ep === p.ep));
  list.unshift(p);
  write(list);
}

export function getEpisodeProgress(id: number, ep: number): WatchProgress | null {
  return read().find((x) => x.id === id && x.ep === ep) ?? null;
}

/**
 * Continue-watching feed: most-recent in-progress episodes, one row per show
 * (its latest episode), completed ones dropped.
 */
export function getContinueWatching(): WatchProgress[] {
  const seen = new Set<number>();
  return read()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((p) => {
      if (isCompleted(p)) return false;
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
}

export function removeProgress(id: number) {
  write(read().filter((x) => x.id !== id));
}

export function subscribeProgress(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb();
  window.addEventListener(EVENT, h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener(EVENT, h);
    window.removeEventListener('storage', h);
  };
}
