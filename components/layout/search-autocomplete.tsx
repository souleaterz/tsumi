'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Search, Loader2, Star } from 'lucide-react';
import { formatFormat, formatScore } from '@/lib/utils';
import type { SearchSuggestion } from '@/lib/anilist/client';

export function SearchAutocomplete({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounced suggestion fetch.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const data = await res.json();
        setResults(data.results ?? []);
        setActive(-1);
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [query]);

  // Close on outside click.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function go(id: number) {
    setOpen(false);
    setQuery('');
    router.push(`/anime/${id}`);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (active >= 0 && results[active]) return go(results[active].id);
    if (query.trim()) {
      setOpen(false);
      router.push(`/browse?search=${encodeURIComponent(query.trim())}`);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => (a + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => (a - 1 + results.length) % results.length);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <form onSubmit={onSubmit} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search anime…"
          aria-label="Search anime"
          className="w-full rounded-md border border-white/10 bg-surface/60 py-2 pl-9 pr-8 text-sm text-zinc-200 outline-none transition focus:border-primary/60 focus:shadow-glow"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-zinc-500" />
        )}
      </form>

      {open && query.trim().length >= 2 && (results.length > 0 || !loading) && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-base/95 p-1.5 shadow-glow-lg backdrop-blur-xl">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-zinc-500">
              No matches for “{query.trim()}”.
            </p>
          ) : (
            results.map((r, i) => {
              const title = r.title.english || r.title.romaji || 'Untitled';
              return (
                <button
                  key={r.id}
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => go(r.id)}
                  className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                    active === i ? 'bg-primary/20' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-surface">
                    {r.coverImage?.medium && (
                      <Image
                        src={r.coverImage.medium}
                        alt={title}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-zinc-100">{title}</p>
                    <p className="flex items-center gap-2 text-[11px] text-zinc-500">
                      {r.format && <span>{formatFormat(r.format)}</span>}
                      {r.seasonYear && <span>{r.seasonYear}</span>}
                      {r.averageScore ? (
                        <span className="flex items-center gap-0.5">
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                          {formatScore(r.averageScore)}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
