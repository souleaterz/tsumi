'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, Info, Star } from 'lucide-react';
import { clsx } from 'clsx';
import type { AnilistMedia } from '@shared/anilist/types';
import type { SeasonGroup } from '@/lib/seasons';
import { displayTitle, stripHtml, formatMeta, ratingOf } from '@/lib/format';
import { FocusButton } from './focus-button';
import { AddToListButton } from './add-to-list-button';
import { EpisodeCard } from './episode-card';
import { Focusable, FocusSection } from './focusable';

interface Props {
  media: AnilistMedia;
  seasons: SeasonGroup[];
}

/**
 * Stremio-style show page: a compact banner header with actions, a season tab
 * bar, and a horizontally-scrollable rail of episode cards for the chosen season.
 */
const CHUNK = 30;

export function ShowView({ media, seasons }: Props) {
  const router = useRouter();
  const [activeSeason, setActiveSeason] = useState(0); // index into seasons
  const [activeChunk, setActiveChunk] = useState(0); // episode range within season

  const title = displayTitle(media);
  const banner = media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large || '';
  const rating = ratingOf(media.averageScore);
  const cover = media.coverImage?.extraLarge || media.coverImage?.large;

  const current = seasons[activeSeason] ?? seasons[0];
  const firstEp = current?.episodes[0]?.episode ?? 1;

  // Long seasons (e.g. One Piece) are split into range blocks so we never render
  // hundreds of focusable cards at once.
  const chunks = useMemo(() => {
    const eps = current?.episodes ?? [];
    const out: typeof eps[] = [];
    for (let i = 0; i < eps.length; i += CHUNK) out.push(eps.slice(i, i + CHUNK));
    return out.length ? out : [[]];
  }, [current]);
  const safeChunk = Math.min(activeChunk, chunks.length - 1);
  const chunkEps = chunks[safeChunk] ?? [];
  const rangeLabel = (block: typeof chunkEps) => {
    if (!block.length) return '';
    const a = block[0].episodeNumber ?? block[0].episode;
    const b = block[block.length - 1].episodeNumber ?? block[block.length - 1].episode;
    return `${a}–${b}`;
  };

  const listItem = useMemo(() => ({ id: media.id, title, cover: cover ?? undefined }), [media.id, title, cover]);

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="relative min-h-[38vh] w-full">
        {banner && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={banner} alt={title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-base via-base/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/30 to-transparent" />
        <div className="relative z-10 flex min-h-[38vh] max-w-[65%] flex-col justify-end px-[var(--tv-safe)] pb-6 pt-10">
          <h1 className="font-heading text-[3rem] leading-none tracking-wide text-white">{title}</h1>
          <div className="mt-3 flex items-center gap-3 text-[0.75rem] text-zinc-300">
            {formatMeta(media) && <span className="rounded bg-white/10 px-2.5 py-1">{formatMeta(media)}</span>}
            {media.episodes && <span className="rounded bg-white/10 px-2.5 py-1">{media.episodes} eps</span>}
            {rating && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="h-4 w-4 fill-current" /> {rating}
              </span>
            )}
            {(media.genres ?? []).slice(0, 3).map((g) => (
              <span key={g} className="rounded bg-white/10 px-2.5 py-1">{g}</span>
            ))}
          </div>
          <FocusSection className="mt-5 flex items-center gap-4">
            <FocusButton
              label="Play"
              Icon={Play}
              variant="primary"
              autoFocus
              onEnterPress={() => router.push(`/watch/${media.id}/${firstEp}`)}
            />
            <FocusButton label="Details" Icon={Info} onEnterPress={() => router.push(`/anime/${media.id}/about`)} />
            <AddToListButton item={listItem} />
          </FocusSection>
        </div>
      </div>

      {/* Season tabs */}
      {seasons.length > 1 && (
        <FocusSection className="flex gap-2 overflow-x-auto px-[var(--tv-safe)] pb-1 pt-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {seasons.map((s, i) => (
            <Focusable key={s.season} ariaLabel={s.label} onEnterPress={() => { setActiveSeason(i); setActiveChunk(0); }}>
              {(focused) => (
                <div
                  className={clsx(
                    'whitespace-nowrap rounded-full px-5 py-2 text-[0.8rem] font-medium transition-colors',
                    i === activeSeason ? 'bg-primary text-white' : focused ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300',
                  )}
                >
                  {s.label}
                </div>
              )}
            </Focusable>
          ))}
        </FocusSection>
      )}

      {/* Episode rail */}
      <h2 className="px-[var(--tv-safe)] pb-3 pt-6 text-[1.15rem] font-medium text-white">
        {current?.label ?? 'Episodes'}
        <span className="ml-2 text-[0.8rem] text-zinc-500">{current?.episodes.length ?? 0} episodes</span>
      </h2>

      {/* Episode range blocks (only when a season is long) */}
      {chunks.length > 1 && (
        <FocusSection className="mb-4 flex gap-2 overflow-x-auto px-[var(--tv-safe)] pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chunks.map((block, i) => (
            <Focusable key={i} ariaLabel={`Episodes ${rangeLabel(block)}`} onEnterPress={() => setActiveChunk(i)}>
              {(focused) => (
                <div
                  className={clsx(
                    'whitespace-nowrap rounded-lg px-4 py-1.5 text-[0.75rem] font-medium transition-colors',
                    i === safeChunk ? 'bg-primary text-white' : focused ? 'bg-white/20 text-white' : 'bg-white/8 text-zinc-300',
                  )}
                >
                  {rangeLabel(block)}
                </div>
              )}
            </Focusable>
          ))}
        </FocusSection>
      )}

      <FocusSection
        key={`${current?.season}-${safeChunk}`}
        className="flex gap-4 overflow-x-auto px-[var(--tv-safe)] pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chunkEps.map((ep) => (
          <EpisodeCard
            key={ep.episode}
            anilistId={media.id}
            ep={ep}
            season={current.season || 1}
            coverFallback={cover ?? undefined}
          />
        ))}
      </FocusSection>
    </div>
  );
}
