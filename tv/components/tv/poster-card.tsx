'use client';

import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import type { AnilistMedia } from '@shared/anilist/types';
import { displayTitle } from '@/lib/format';
import { Focusable } from './focusable';

interface Props {
  media: AnilistMedia;
  /** 0-1 watch progress → thin bar along the bottom (Continue watching). */
  progress?: number;
  /** Small caption under the title, e.g. "E14 · 21m left". */
  caption?: string;
  /** Grab initial focus (first card of the first rail on a page). */
  autoFocus?: boolean;
  /** Fires when the D-pad lands on this card — Home uses it to swap the hero. */
  onFocusMedia?: (media: AnilistMedia) => void;
  /** Fires on OK/select, before navigating — Search uses it to log history. */
  onSelect?: () => void;
  /** Navigation target override (default /anime/:id) — Continue watching → /watch. */
  href?: string;
}

/** A poster tile in a rail or grid. Focus draws a clean white box (no zoom). */
export function PosterCard({ media, progress, caption, autoFocus, onFocusMedia, onSelect, href }: Props) {
  const router = useRouter();
  const title = displayTitle(media);
  const cover = media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium || '';

  return (
    <Focusable
      bare
      ariaLabel={title}
      scrollOnFocus
      autoFocus={autoFocus}
      onFocus={() => onFocusMedia?.(media)}
      onEnterPress={() => {
        onSelect?.();
        router.push(href ?? `/anime/${media.id}`);
      }}
      className="w-[11vw] min-w-[150px] shrink-0"
    >
      {(focused) => (
        <div>
          <div
            className={clsx(
              'relative aspect-[2/3] w-full overflow-hidden rounded-xl border bg-surface',
              // Clean white box slightly larger than the poster; no zoom.
              focused ? 'border-transparent outline outline-[3px] outline-white [outline-offset:4px]' : 'border-white/10',
            )}
            style={media.coverImage?.color ? { backgroundColor: media.coverImage.color } : undefined}
          >
            {cover && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={title}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            )}
            {progress != null && progress > 0 && (
              <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/50">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${Math.min(100, Math.round(progress * 100))}%` }}
                />
              </div>
            )}
          </div>
          <p className={clsx('mt-2 truncate text-[0.8rem]', focused ? 'text-white' : 'text-zinc-300')}>
            {title}
          </p>
          {caption && <p className="truncate text-[0.68rem] text-zinc-500">{caption}</p>}
        </div>
      )}
    </Focusable>
  );
}
