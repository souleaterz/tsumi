import Link from 'next/link';
import Image from 'next/image';
import { Star, Play } from 'lucide-react';
import type { AnilistMedia } from '@/lib/anilist/types';
import { bestTitle, formatFormat, formatScore } from '@/lib/utils';
import { FavouriteButton } from '@/components/ui/favourite-button';
import { Countdown } from '@/components/ui/countdown';

// A little katakana flavour to scatter on cards.
const KATAKANA = ['アニメ', 'エピソード', '視聴', '人気', '新着'];

export function AnimeCard({
  media,
  index = 0,
  className = '',
}: {
  media: AnilistMedia;
  index?: number;
  className?: string;
}) {
  const title = bestTitle(media.title);
  const cover =
    media.coverImage?.extraLarge || media.coverImage?.large || media.coverImage?.medium;
  const accent = media.coverImage?.color || '#7C3AED';
  const kana = KATAKANA[index % KATAKANA.length];

  return (
    <Link
      href={`/anime/${media.id}`}
      className={`card-glow group relative block w-full overflow-hidden rounded-xl ${className}`}
    >
      {/* Cover */}
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface">
        {cover ? (
          <Image
            src={cover}
            alt={title}
            fill
            sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 200px"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-zinc-600">
            <span className="font-jp text-3xl">罪</span>
          </div>
        )}

        {/* Glow ring on hover */}
        <div
          className="pointer-events-none absolute inset-0 rounded-xl opacity-0 ring-2 ring-inset transition-opacity duration-300 group-hover:opacity-100"
          style={{ boxShadow: `inset 0 0 30px ${accent}66`, borderColor: accent }}
        />

        {/* Gradient + hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/20 to-transparent" />
        <div className="absolute inset-0 flex items-center justify-center bg-base/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-300 group-hover:opacity-100">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-glow"
            style={{ backgroundColor: accent }}
          >
            <Play className="h-5 w-5 translate-x-px fill-current" />
          </span>
        </div>

        {/* Score badge */}
        {media.averageScore ? (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-base/80 px-1.5 py-0.5 text-xs font-semibold backdrop-blur">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            <span className="text-zinc-100">{formatScore(media.averageScore)}</span>
          </div>
        ) : null}

        {/* Favourite heart + format tag + katakana */}
        <div className="absolute left-2 top-2 flex flex-col items-start gap-1.5">
          <FavouriteButton
            item={{
              anilistId: media.id,
              title,
              coverImage: cover ?? undefined,
              format: media.format ?? undefined,
              addedAt: Date.now(),
            }}
          />
          {media.format && (
            <span className="rounded bg-primary/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {formatFormat(media.format)}
            </span>
          )}
          <span className="katakana text-[7px] leading-none">{kana}</span>
        </div>
      </div>

      {/* Title */}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-white transition-colors group-hover:text-accent">
          {title}
        </h3>
        {media.nextAiringEpisode ? (
          <Countdown
            airingAt={media.nextAiringEpisode.airingAt}
            episode={media.nextAiringEpisode.episode}
            variant="compact"
            className="mt-0.5 text-[11px] font-medium text-accent"
          />
        ) : (
          <p className="mt-0.5 text-[11px] text-zinc-400">
            {media.seasonYear ? media.seasonYear : ''}
            {media.episodes ? ` · ${media.episodes} ep` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
