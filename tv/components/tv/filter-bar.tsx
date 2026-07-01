'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { Focusable, FocusSection } from './focusable';

const SORTS = [
  { key: 'TRENDING_DESC', label: 'Trending' },
  { key: 'POPULARITY_DESC', label: 'Popular' },
  { key: 'SCORE_DESC', label: 'Top rated' },
  { key: 'START_DATE_DESC', label: 'Newest' },
];

const GENRES = ['Action', 'Adventure', 'Fantasy', 'Romance', 'Comedy', 'Drama', 'Sci-Fi', 'Supernatural', 'Mystery', 'Slice of Life'];

/** Focusable filter chips for Browse. Selecting one updates the URL params. */
export function FilterBar() {
  const router = useRouter();
  const params = useSearchParams();
  const sort = params.get('sort') || 'TRENDING_DESC';
  const genre = params.get('genre') || '';

  const go = (next: Record<string, string>) => {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    // Replace, not push: a filter tweak refines the current view — it shouldn't
    // stack a new history entry (that was a big source of the "back walks
    // through dozens of pages" problem on the way to exiting).
    router.replace(`/browse?${p.toString()}`);
  };

  return (
    <div className="space-y-3 px-[var(--tv-safe)] pb-6">
      <FocusSection className="flex flex-wrap gap-2">
        {SORTS.map((s, i) => (
          <Chip key={s.key} label={s.label} active={sort === s.key} autoFocus={i === 0} onEnterPress={() => go({ sort: s.key })} />
        ))}
      </FocusSection>
      <FocusSection className="flex flex-wrap gap-2">
        <Chip label="All genres" active={!genre} onEnterPress={() => go({ genre: '' })} />
        {GENRES.map((g) => (
          <Chip key={g} label={g} active={genre === g} onEnterPress={() => go({ genre: g })} />
        ))}
      </FocusSection>
    </div>
  );
}

function Chip({ label, active, onEnterPress, autoFocus }: { label: string; active: boolean; onEnterPress: () => void; autoFocus?: boolean }) {
  return (
    <Focusable ariaLabel={label} onEnterPress={onEnterPress} autoFocus={autoFocus}>
      {(focused) => (
        <div
          className={clsx(
            'rounded-full px-4 py-2 text-[0.78rem] font-medium transition-colors',
            active ? 'bg-primary text-white' : focused ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300',
          )}
        >
          {label}
        </div>
      )}
    </Focusable>
  );
}
