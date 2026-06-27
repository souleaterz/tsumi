'use client';

import type { StreamSource } from '@/lib/stream/sources';

// ─────────────────────────────────────────────────────────────
// Per-anime source preference memory.
//
// When the viewer watches a source successfully (manual pick or auto), we
// fingerprint it by release group + quality + container and persist that.
// Loading the next episode, we match the same fingerprint against the new
// source list so they get the same release group automatically — exactly what
// happens with real anime sites (you stick to your release group of choice).
// ─────────────────────────────────────────────────────────────

const KEY_PREFIX = 'tsumi:sourcePref:';

export interface SourceFingerprint {
  group?: string; // e.g. "SubsPlease", "Erai-raws", "ASW"
  quality?: string; // "720p", "1080p", etc.
  container?: 'mp4' | 'mkv' | 'webm';
  savedAt: number;
}

/** Pull a release-group bracket out of a release title. */
function extractGroup(title: string): string | undefined {
  // Typical patterns:  "[SubsPlease] Title - 01 ..."  or  "Title.[Erai-raws]"
  const bracket = title.match(/[\[\(]([A-Za-z0-9_-]{2,32})[\]\)]/);
  if (bracket) return bracket[1];
  // Sometimes the group is a dot-separated token like ".SubsPlease."
  const dotted = title.match(/\b(SubsPlease|Erai-raws|HorribleSubs|ASW|Anime Time|Judas|EMBER|smol|YameteTomete)\b/i);
  return dotted?.[1];
}

function extractContainer(s: StreamSource): 'mp4' | 'mkv' | 'webm' | undefined {
  const text = `${s.title ?? ''}`;
  if (/\.mp4\b/i.test(text)) return 'mp4';
  if (/\.mkv\b/i.test(text)) return 'mkv';
  if (/\.webm\b/i.test(text)) return 'webm';
  return undefined;
}

export function fingerprint(s: StreamSource): SourceFingerprint {
  return {
    group: extractGroup(s.title ?? ''),
    quality: s.quality,
    container: extractContainer(s),
    savedAt: Date.now(),
  };
}

export function saveSourcePref(anilistId: number, s: StreamSource) {
  if (typeof window === 'undefined') return;
  try {
    const fp = fingerprint(s);
    if (!fp.group && !fp.quality) return; // nothing useful to remember
    localStorage.setItem(KEY_PREFIX + anilistId, JSON.stringify(fp));
  } catch {
    /* localStorage may be disabled (private mode) */
  }
}

export function loadSourcePref(anilistId: number): SourceFingerprint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(KEY_PREFIX + anilistId);
    if (!raw) return null;
    return JSON.parse(raw) as SourceFingerprint;
  } catch {
    return null;
  }
}

/**
 * Find the best matching source for a remembered fingerprint. Strongest match
 * wins: group + quality + container > group + quality > group > quality. Returns
 * -1 if nothing reasonable matches (caller falls back to ranking default).
 */
export function pickPreferredIndex(
  sources: StreamSource[],
  pref: SourceFingerprint,
): number {
  if (!sources.length) return -1;

  let bestIdx = -1;
  let bestScore = 0;

  for (let i = 0; i < sources.length; i++) {
    const fp = fingerprint(sources[i]);
    let score = 0;
    if (pref.group && fp.group && pref.group.toLowerCase() === fp.group.toLowerCase()) {
      score += 4;
    }
    if (pref.quality && fp.quality && pref.quality === fp.quality) {
      score += 2;
    }
    if (pref.container && fp.container && pref.container === fp.container) {
      score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }

  // Need at least a quality or group match to use the preference.
  return bestScore >= 2 ? bestIdx : -1;
}
