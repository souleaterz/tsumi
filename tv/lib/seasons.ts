import type { EpisodeMeta } from '@shared/stream/sources';

export interface SeasonGroup {
  season: number;
  label: string;
  episodes: EpisodeMeta[];
}

function synth(total?: number): SeasonGroup[] {
  const n = Math.max(1, Math.min(total || 12, 500));
  return [
    {
      season: 1,
      label: 'Season 1',
      episodes: Array.from({ length: n }, (_, i) => ({ episode: i + 1, episodeNumber: i + 1 })),
    },
  ];
}

/**
 * Group Anizip episode metadata into real (TVDB) seasons for the season tab bar.
 * Season 0 is "Specials". Falls back to a synthetic single season built from the
 * AniList episode count when no metadata is available.
 */
export function groupSeasons(meta: EpisodeMeta[], totalEpisodes?: number): SeasonGroup[] {
  if (!meta.length) return synth(totalEpisodes);

  const map = new Map<number, EpisodeMeta[]>();
  for (const e of meta) {
    const s = e.seasonNumber ?? 1;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push(e);
  }

  const groups = [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([season, eps]) => ({
      season,
      label: season === 0 ? 'Specials' : `Season ${season}`,
      episodes: eps.sort((a, b) => a.episode - b.episode),
    }));

  return groups.length ? groups : synth(totalEpisodes);
}
