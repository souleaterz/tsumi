'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import { Filter, X } from 'lucide-react';

const FORMATS = ['TV', 'TV_SHORT', 'MOVIE', 'SPECIAL', 'OVA', 'ONA'];
const STATUSES = ['RELEASING', 'FINISHED', 'NOT_YET_RELEASED', 'CANCELLED'];
const SORTS = [
  { value: 'POPULARITY_DESC', label: 'Most Popular' },
  { value: 'TRENDING_DESC', label: 'Trending' },
  { value: 'SCORE_DESC', label: 'Highest Rated' },
  { value: 'START_DATE_DESC', label: 'Newest' },
  { value: 'FAVOURITES_DESC', label: 'Most Favourited' },
];

const YEARS = Array.from({ length: 26 }, (_, i) => new Date().getFullYear() + 1 - i);

function label(s: string) {
  return s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function FilterBar({ genres }: { genres: string[] }) {
  const router = useRouter();
  const params = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      next.delete('page');
      router.push(`/browse?${next.toString()}`);
    },
    [params, router],
  );

  const hasFilters = ['genre', 'format', 'status', 'seasonYear', 'search'].some((k) =>
    params.get(k),
  );

  const select =
    'rounded-md border border-white/10 bg-surface/60 px-3 py-2 text-sm text-zinc-200 outline-none transition focus:border-primary/60 focus:shadow-glow';

  return (
    <div className="glass sticky top-16 z-30 -mx-4 mb-8 rounded-none px-4 py-4 sm:mx-0 sm:rounded-xl sm:px-5">
      <div className="mb-3 flex items-center gap-2 text-zinc-400">
        <Filter className="h-4 w-4" />
        <span className="text-sm font-semibold tracking-wide">Filters</span>
        <span className="katakana text-[9px]">フィルター</span>
        {hasFilters && (
          <button
            onClick={() => router.push('/browse')}
            className="ml-auto flex items-center gap-1 text-xs text-action transition hover:brightness-125"
          >
            <X className="h-3 w-3" /> Clear all
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <select
          value={params.get('genre') ?? ''}
          onChange={(e) => setParam('genre', e.target.value)}
          className={select}
        >
          <option value="">All Genres</option>
          {genres.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <select
          value={params.get('seasonYear') ?? ''}
          onChange={(e) => setParam('seasonYear', e.target.value)}
          className={select}
        >
          <option value="">Any Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <select
          value={params.get('format') ?? ''}
          onChange={(e) => setParam('format', e.target.value)}
          className={select}
        >
          <option value="">Any Format</option>
          {FORMATS.map((f) => (
            <option key={f} value={f}>
              {label(f)}
            </option>
          ))}
        </select>

        <select
          value={params.get('status') ?? ''}
          onChange={(e) => setParam('status', e.target.value)}
          className={select}
        >
          <option value="">Any Status</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </select>

        <select
          value={params.get('sort') ?? 'POPULARITY_DESC'}
          onChange={(e) => setParam('sort', e.target.value)}
          className={`${select} ml-auto`}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
