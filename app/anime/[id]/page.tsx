import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Play, Star, Calendar, Clapperboard, Heart } from 'lucide-react';
import { getAnimeDetail } from '@/lib/anilist/client';
import { getEpisodeMeta } from '@/lib/stream/sources';
import { bestTitle, formatFormat, formatScore, stripHtml } from '@/lib/utils';
import { GenreTag } from '@/components/ui/genre-tag';
import { AnimeCard } from '@/components/ui/anime-card';
import { SectionHeader } from '@/components/ui/section-header';
import { WatchlistButton } from '@/components/anime/watchlist-button';
import { EpisodeList } from '@/components/anime/episode-list';

export const revalidate = 1800;

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const media = await getAnimeDetail(Number(params.id));
  if (!media) return { title: 'Not found' };
  const title = bestTitle(media.title);
  const description = stripHtml(media.description).slice(0, 160);
  const image =
    media.bannerImage || media.coverImage?.extraLarge || media.coverImage?.large;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'video.tv_show',
      images: image ? [{ url: image, width: 1200, height: 630, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function AnimeDetailPage({ params }: Props) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const [media, epMeta] = await Promise.all([
    getAnimeDetail(id),
    getEpisodeMeta(id),
  ]);
  if (!media) notFound();

  const title = bestTitle(media.title);
  const banner = media.bannerImage || media.coverImage?.extraLarge;
  const cover = media.coverImage?.extraLarge || media.coverImage?.large;
  const accent = media.coverImage?.color || '#7C3AED';
  const studio = media.studios?.nodes?.find((s) => s.isAnimationStudio);
  const recommendations: any[] = (media as any).recommendations?.nodes ?? [];

  return (
    <div className="relative">
      {/* Banner */}
      <div className="relative h-[42vh] min-h-[300px] w-full overflow-hidden">
        {banner && (
          <Image src={banner} alt={title} fill priority className="object-cover object-center" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-base/20" />
        <div className="grain pointer-events-none absolute inset-0" />
        <span className="font-jp pointer-events-none absolute right-8 top-10 text-8xl text-white/5">
          罪
        </span>
      </div>

      <div className="mx-auto -mt-40 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Poster + actions */}
          <div className="z-10 mx-auto w-48 shrink-0 sm:w-60 lg:mx-0">
            <div
              className="overflow-hidden rounded-xl border border-white/10 shadow-glow-lg"
              style={{ boxShadow: `0 0 40px ${accent}55` }}
            >
              {cover && (
                <Image
                  src={cover}
                  alt={title}
                  width={480}
                  height={720}
                  className="aspect-[2/3] w-full object-cover"
                />
              )}
            </div>
            <div className="mt-4 flex flex-col gap-3">
              <Link href={`/watch/${media.id}/1`} className="btn-cta w-full">
                <Play className="h-5 w-5 fill-current" /> Watch Ep 1
              </Link>
              <WatchlistButton
                item={{
                  anilistId: media.id,
                  title,
                  coverImage: cover ?? undefined,
                  format: media.format ?? undefined,
                  addedAt: Date.now(),
                }}
              />
            </div>
          </div>

          {/* Info */}
          <div className="z-10 flex-1 pt-2 lg:pt-40">
            <span className="katakana text-[10px]">アニメ詳細</span>
            <h1 className="mt-1 text-4xl leading-tight text-white text-glow sm:text-6xl">
              {title}
            </h1>
            {media.title.native && (
              <p className="mt-1 font-jp text-lg text-zinc-400">{media.title.native}</p>
            )}

            {/* Meta chips */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
              {media.averageScore ? (
                <span className="flex items-center gap-1.5 font-semibold">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  {formatScore(media.averageScore)}
                </span>
              ) : null}
              {media.popularity ? (
                <span className="flex items-center gap-1.5">
                  <Heart className="h-4 w-4 text-action" />
                  {media.popularity.toLocaleString()}
                </span>
              ) : null}
              {media.format && (
                <span className="flex items-center gap-1.5">
                  <Clapperboard className="h-4 w-4 text-accent" />
                  {formatFormat(media.format)}
                </span>
              )}
              {media.seasonYear && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-accent" />
                  {media.season
                    ? `${media.season[0]}${media.season.slice(1).toLowerCase()} `
                    : ''}
                  {media.seasonYear}
                </span>
              )}
              {media.episodes && <span>{media.episodes} episodes</span>}
              {media.status && (
                <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-accent">
                  {media.status.replace(/_/g, ' ')}
                </span>
              )}
            </div>

            {/* Genres */}
            <div className="mt-4 flex flex-wrap gap-2">
              {media.genres?.map((g) => (
                <GenreTag key={g} genre={g} />
              ))}
            </div>

            {/* Synopsis */}
            <p className="mt-5 max-w-3xl whitespace-pre-line text-sm leading-relaxed text-zinc-300">
              {stripHtml(media.description) || 'No synopsis available.'}
            </p>

            {studio && (
              <p className="mt-4 text-sm text-zinc-500">
                Studio: <span className="text-zinc-300">{studio.name}</span>
              </p>
            )}
          </div>
        </div>

        {/* Trailer */}
        {media.trailer?.site === 'youtube' && media.trailer.id && (
          <section className="mt-14">
            <SectionHeader title="Trailer" jp="予告編" />
            <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 shadow-glow">
              <iframe
                src={`https://www.youtube.com/embed/${media.trailer.id}`}
                title="Trailer"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
          </section>
        )}

        {/* Episodes */}
        <section className="mt-14">
          <SectionHeader title="Episodes" jp="エピソード" />
          <EpisodeList
            anilistId={media.id}
            totalEpisodes={media.episodes ?? 0}
            meta={epMeta}
            cover={cover ?? undefined}
          />
        </section>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <section className="mt-14">
            <SectionHeader title="You May Also Like" jp="おすすめ" />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {recommendations
                .filter((r) => r.mediaRecommendation)
                .slice(0, 12)
                .map((r, i) => (
                  <AnimeCard key={r.mediaRecommendation.id} media={r.mediaRecommendation} index={i} />
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
