'use client';

// Real-Debrid key for the TV app. Stored locally so playback can use the RD
// direct-link path; the same value is what the watch page checks to reveal the
// Real-Debrid source tab. Pairing (see lib/pairing.ts) can push this key from a
// phone so it needn't be typed on the remote.

const KEY = 'tsumi.tv.rdkey';
const EVENT = 'tsumi-rdkey-change';

export function getRdKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
}

export function setRdKey(k: string) {
  try {
    if (k) localStorage.setItem(KEY, k);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeRdKey(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const h = () => cb();
  window.addEventListener(EVENT, h);
  window.addEventListener('storage', h);
  return () => {
    window.removeEventListener(EVENT, h);
    window.removeEventListener('storage', h);
  };
}

/** Mask for display — never show the full token on screen. */
export function maskKey(k: string): string {
  if (!k) return '';
  return k.length <= 8 ? '••••' : `${k.slice(0, 4)}…${k.slice(-4)}`;
}
