'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bookmark, History, Clapperboard, Trash2 } from 'lucide-react';
import { getWatchlist, type WatchlistItem } from '@/lib/watchlist';
import { getContinueWatching, type ProgressEntry } from '@/lib/progress';
import { SectionHeader } from '@/components/ui/section-header';
import { useUserId } from '@/lib/auth/use-user-id';
import { useWatchlist } from '@/components/watchlist-provider';
import { ProCard } from './pro-card';
import { RdKeyCard } from './rd-key-card';

type Tab = 'watchlist' | 'history';

export function ProfileClient({ isPro = false }: { isPro?: boolean }) {
  const [tab, setTab] = useState<Tab>('watchlist');
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<ProgressEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { userId, isLoaded } = useUserId();
  const { toggle } = useWatchlist();

  useEffect(() => {
    if (!isLoaded) return;
    Promise.all([getWatchlist(userId), getContinueWatching(userId, 24, true)]).then(
      ([w, h]) => {
        setWatchlist(w);
        setHistory(h);
        setLoaded(true);
      },
    );
  }, [isLoaded, userId]);

  async function remove(item: WatchlistItem) {
    setWatchlist((list) => list.filter((i) => i.anilistId !== item.anilistId));
    await toggle(item); // persists removal + keeps card hearts in sync
  }

  const stats = [
    { label: 'In Watchlist', value: watchlist.length, jp: 'リスト', icon: Bookmark },
    { label: 'Watching', value: history.length, jp: '視聴中', icon: Clapperboard },
    {
      label: 'Episodes Started',
      value: history.length,
      jp: 'エピソード',
      icon: History,
    },
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <div>
        {/* Stats */}
        <div className="mb-8 grid grid-cols-3 gap-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="glass relative overflow-hidden rounded-xl p-4 text-center"
            >
              <s.icon className="mx-auto mb-2 h-5 w-5 text-accent" />
              <p className="font-heading text-3xl text-white">{s.value}</p>
              <p className="text-[11px] text-zinc-400">{s.label}</p>
              <span className="katakana absolute right-2 top-2 text-[7px]">{s.jp}</span>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-5 flex gap-2 border-b border-white/5">
          {(['watchlist', 'history'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative px-4 py-2 text-sm font-semibold capitalize transition ${
                tab === t ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-primary to-accent" />
              )}
            </button>
          ))}
        </div>

        {!loaded ? (
          <p className="py-12 text-center text-sm text-zinc-500">Loading…</p>
        ) : tab === 'watchlist' ? (
          watchlist.length === 0 ? (
            <EmptyState
              icon={Bookmark}
              text="Your watchlist is empty."
              cta="Browse anime"
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {watchlist.map((item) => (
                <div key={item.anilistId} className="group relative">
                  <Link
                    href={`/anime/${item.anilistId}`}
                    className="card-glow block overflow-hidden rounded-xl"
                  >
                    <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface">
                      {item.coverImage && (
                        <Image
                          src={item.coverImage}
                          alt={item.title}
                          fill
                          sizes="180px"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-base via-transparent to-transparent" />
                      <h3 className="absolute inset-x-0 bottom-0 line-clamp-2 p-2 text-xs font-semibold text-white">
                        {item.title}
                      </h3>
                    </div>
                  </Link>
                  <button
                    onClick={() => remove(item)}
                    aria-label="Remove"
                    className="absolute right-2 top-2 rounded-md bg-base/80 p-1.5 text-zinc-300 opacity-0 backdrop-blur transition hover:text-action group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )
        ) : history.length === 0 ? (
          <EmptyState icon={History} text="No watch history yet." cta="Start watching" />
        ) : (
          <div className="grid gap-3">
            {history.map((entry) => {
              const pct =
                entry.durationSec > 0
                  ? Math.min(100, (entry.positionSec / entry.durationSec) * 100)
                  : 0;
              return (
                <Link
                  key={`${entry.anilistId}-${entry.episode}`}
                  href={`/watch/${entry.anilistId}/${entry.episode}`}
                  className="group flex items-center gap-4 rounded-xl border border-white/5 bg-surface/40 p-3 transition hover:border-primary/40 hover:bg-surface/70"
                >
                  <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-base">
                    {entry.coverImage && (
                      <Image
                        src={entry.coverImage}
                        alt={entry.title}
                        fill
                        sizes="112px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-semibold text-white group-hover:text-accent">
                      {entry.title}
                    </h4>
                    <p className="text-xs text-zinc-500">Episode {entry.episode}</p>
                    <div className="mt-2 h-1 w-full rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Sidebar */}
      <aside className="space-y-6">
        <RdKeyCard />
        <ProCard isPro={isPro} />
      </aside>
    </div>
  );
}

function EmptyState({
  icon: Icon,
  text,
  cta,
}: {
  icon: typeof Bookmark;
  text: string;
  cta: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/10 py-16 text-center">
      <Icon className="h-10 w-10 text-zinc-700" />
      <p className="text-sm text-zinc-500">{text}</p>
      <Link href="/browse" className="btn-ghost mt-1 text-sm">
        {cta}
      </Link>
    </div>
  );
}
