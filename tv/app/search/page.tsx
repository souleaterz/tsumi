'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { AnilistMedia } from '@shared/anilist/types';
import { OnScreenKeyboard } from '@/components/tv/on-screen-keyboard';
import { PosterCard } from '@/components/tv/poster-card';
import { Focusable, FocusSection } from '@/components/tv/focusable';
import { getRecentSearches, pushSearch, removeSearch, clearSearches } from '@/lib/search-history';

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AnilistMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => setRecent(getRecentSearches()), []);

  const runSearch = useCallback((q: string) => {
    clearTimeout(debounce.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounce.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.media ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }, []);

  useEffect(() => {
    runSearch(query);
    return () => clearTimeout(debounce.current);
  }, [query, runSearch]);

  const record = () => {
    pushSearch(query);
    setRecent(getRecentSearches());
  };

  const showRecent = query.trim().length < 2 && recent.length > 0;
  const hasResults = results.length > 0;

  return (
    <div className="pt-8">
      <div className="flex gap-10 px-[var(--tv-safe)]">
        {/* Keyboard + query display */}
        <div className="shrink-0">
          <div className="mb-4 flex h-12 min-w-[22rem] items-center rounded-xl border border-white/15 bg-surface/50 px-4 text-[1.1rem] text-white">
            {query || <span className="text-zinc-500">Search anime…</span>}
            <span className="ml-0.5 inline-block h-6 w-0.5 animate-pulse bg-accent" />
          </div>
          <OnScreenKeyboard
            onKey={(ch) => setQuery((q) => q + ch)}
            onDelete={() => setQuery((q) => q.slice(0, -1))}
            onSpace={() => setQuery((q) => q + ' ')}
          />
        </div>

        {/* Results / recent searches */}
        <div className="min-w-0 flex-1">
          {showRecent ? (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[1.1rem] font-medium text-white">Recent searches</h2>
                <Focusable ariaLabel="Clear recent searches" onEnterPress={() => { clearSearches(); setRecent([]); }}>
                  {(f) => (
                    <span className={clsx('rounded-lg px-3 py-1.5 text-[0.75rem]', f ? 'bg-white/20 text-white' : 'text-zinc-500')}>
                      Clear all
                    </span>
                  )}
                </Focusable>
              </div>
              <FocusSection className="flex flex-col gap-2">
                {recent.map((term) => (
                  <Focusable
                    key={term}
                    ariaLabel={`Search ${term}`}
                    className="max-w-[32rem]"
                    onEnterPress={() => setQuery(term)}
                  >
                    {(f) => (
                      <div className={clsx('flex items-center gap-3 rounded-xl px-4 py-3 transition-colors', f ? 'bg-white/15 text-white' : 'bg-white/6 text-zinc-300')}>
                        <Clock className="h-4 w-4 text-zinc-500" />
                        <span className="flex-1 truncate text-[0.9rem]">{term}</span>
                        <button
                          aria-label={`Remove ${term}`}
                          onClick={(e) => { e.stopPropagation(); removeSearch(term); setRecent(getRecentSearches()); }}
                          className="text-zinc-500 hover:text-white"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </Focusable>
                ))}
              </FocusSection>
            </>
          ) : (
            <>
              <h2 className="mb-4 text-[1.1rem] font-medium text-white">
                {loading ? 'Searching…' : hasResults ? 'Results' : query.trim().length >= 2 ? 'No matches' : 'Type to search'}
              </h2>
              <FocusSection className="grid grid-cols-4 gap-x-4 gap-y-6">
                {results.map((m, i) => (
                  <PosterCard key={`${m.id}-${i}`} media={m} onSelect={record} />
                ))}
              </FocusSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
