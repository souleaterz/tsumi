'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { Play, ArrowLeft, Star } from 'lucide-react';
import type { AnilistMedia } from '@shared/anilist/types';
import { displayTitle, stripHtml, formatMeta, ratingOf } from '@/lib/format';
import { FocusButton } from './focus-button';
import { AddToListButton } from './add-to-list-button';
import { Focusable, FocusSection } from './focusable';

/** Full information view: synopsis, facts, and an embedded trailer. */
export function AboutView({ media, trailerId }: { media: AnilistMedia; trailerId: string | null }) {
  const router = useRouter();
  const [playTrailer, setPlayTrailer] = useState(false);
  const title = displayTitle(media);
  const cover = media.coverImage?.extraLarge || media.coverImage?.large;
  const rating = ratingOf(media.averageScore);
  const studio = media.studios?.nodes?.find((s) => s.isAnimationStudio)?.name;
  const listItem = useMemo(() => ({ id: media.id, title, cover: cover ?? undefined }), [media.id, title, cover]);

  return (
    <div className="px-[var(--tv-safe)] py-8">
      <div className="flex gap-8">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={title} className="h-[36vh] w-auto shrink-0 rounded-xl border border-white/10 object-cover" />
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-[2.8rem] leading-none tracking-wide text-white">{title}</h1>
          {media.title.native && <p className="katakana mt-1 text-[0.7rem]">{media.title.native}</p>}

          <div className="mt-4 flex flex-wrap items-center gap-3 text-[0.75rem] text-zinc-300">
            {formatMeta(media) && <span className="rounded bg-white/10 px-2.5 py-1">{formatMeta(media)}</span>}
            {media.episodes && <span className="rounded bg-white/10 px-2.5 py-1">{media.episodes} eps</span>}
            {media.status && <span className="rounded bg-white/10 px-2.5 py-1">{media.status.replace(/_/g, ' ')}</span>}
            {studio && <span className="rounded bg-white/10 px-2.5 py-1">{studio}</span>}
            {rating && (
              <span className="flex items-center gap-1 text-yellow-400">
                <Star className="h-4 w-4 fill-current" /> {rating}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(media.genres ?? []).map((g) => (
              <span key={g} className="rounded-full bg-primary/15 px-3 py-1 text-[0.72rem] text-accent">{g}</span>
            ))}
          </div>

          <p className="mt-4 max-w-[52rem] text-[0.85rem] leading-relaxed text-zinc-300">
            {stripHtml(media.description) || 'No synopsis available.'}
          </p>

          <FocusSection className="mt-6 flex items-center gap-4">
            <FocusButton label="Play" Icon={Play} variant="primary" autoFocus onEnterPress={() => router.push(`/watch/${media.id}/1`)} />
            <AddToListButton item={listItem} />
            <FocusButton label="Back" Icon={ArrowLeft} onEnterPress={() => router.back()} />
          </FocusSection>
        </div>
      </div>

      {/* Trailer — focusable so the D-pad can scroll down to it; OK plays it. */}
      {trailerId && (
        <div className="mt-10">
          <h2 className="mb-3 text-[1.1rem] font-medium text-white">Trailer</h2>
          <Focusable
            scrollOnFocus={{ block: 'center' }}
            ariaLabel="Play trailer"
            className="w-[60%] min-w-[520px]"
            onEnterPress={() => setPlayTrailer(true)}
          >
            {(focused) => (
              <div
                className={clsx(
                  'relative aspect-video w-full overflow-hidden rounded-xl border bg-black',
                  focused ? 'border-transparent outline outline-[3px] outline-white [outline-offset:4px]' : 'border-white/10',
                )}
              >
                {playTrailer ? (
                  <iframe
                    title={`${title} trailer`}
                    src={`https://www.youtube-nocookie.com/embed/${trailerId}?rel=0&autoplay=1`}
                    className="h-full w-full"
                    allow="autoplay; accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <>
                    {media.trailer?.thumbnail && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={media.trailer.thumbnail} alt="" className="h-full w-full object-cover opacity-70" />
                    )}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/40">
                      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
                        <Play className="h-7 w-7 fill-base text-base" />
                      </span>
                      <span className="text-[0.8rem] text-white">Press OK to play</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </Focusable>
        </div>
      )}
    </div>
  );
}
