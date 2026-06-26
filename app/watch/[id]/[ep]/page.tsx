import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { getAnimeDetail } from '@/lib/anilist/client';
import { resolveStreams, getEpisodeMeta, isDebridEnabled } from '@/lib/stream/sources';
import { bestTitle } from '@/lib/utils';
import { getProStatus, currentUserId } from '@/lib/subscription';
import { WatchExperience } from '@/components/watch/watch-experience';
import { EpisodeNav } from '@/components/watch/episode-nav';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; ep: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const media = await getAnimeDetail(Number(params.id));
  const t = media ? bestTitle(media.title) : 'Watch';
  return { title: `${t} — Episode ${params.ep}` };
}

export default async function WatchPage({ params }: Props) {
  const id = Number(params.id);
  const ep = Number(params.ep);
  if (!Number.isFinite(id) || !Number.isFinite(ep) || ep < 1) notFound();

  const userId = await currentUserId();
  const [media, epMeta, isPro] = await Promise.all([
    getAnimeDetail(id),
    getEpisodeMeta(id),
    getProStatus(userId),
  ]);
  if (!media) notFound();

  const title = bestTitle(media.title);
  // Romaji title gives the Nyaa fallback the best chance of matching releases.
  const resolved = await resolveStreams(
    id,
    ep,
    media.title.romaji || media.title.english || undefined,
  );

  // Sanitise for the client: Real-Debrid sources carry a resolver URL with the
  // RD key — strip it and expose a keyless /api/stream-url endpoint instead.
  const sources = resolved.map((s) => {
    const { url, ...safe } = s;
    if (url) {
      return {
        ...safe,
        playUrl: `/api/stream-url/${id}/${ep}?t=${encodeURIComponent(s.title)}`,
      };
    }
    return safe;
  });

  const cover = media.coverImage?.extraLarge || media.coverImage?.large || undefined;
  const totalEpisodes = media.episodes ?? epMeta.length ?? 1;
  const epInfo = epMeta.find((e) => e.episode === ep);

  // All quality tiers are available to everyone — HD sources are usually the
  // best-seeded / cached ones, so capping free users only hurt performance.
  const availableSources = sources;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <Link
        href={`/anime/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to {title}
      </Link>

      {/* Player */}
      <WatchExperience
        anilistId={id}
        episode={ep}
        title={title}
        coverImage={cover}
        totalEpisodes={totalEpisodes}
        sources={availableSources}
        isPro={isPro}
      />

      {/* Title + nav */}
      <div className="mt-5 flex flex-col gap-4">
        <div>
          <span className="katakana text-[10px]">エピソード {ep}</span>
          <h1 className="text-3xl text-white sm:text-4xl">
            {title}
            <span className="ml-3 text-accent">EP {ep}</span>
          </h1>
          {epInfo?.title && (
            <p className="mt-1 text-zinc-400">{epInfo.title}</p>
          )}
        </div>

        <EpisodeNav anilistId={id} episode={ep} totalEpisodes={totalEpisodes} />

        {epInfo?.overview && (
          <p className="max-w-3xl text-sm leading-relaxed text-zinc-400">
            {epInfo.overview}
          </p>
        )}

        {availableSources.length > 0 && (
          <p className="text-xs text-zinc-600">
            {availableSources.length} stream source
            {availableSources.length > 1 ? 's' : ''} available · resolved via Torrentio
            {isDebridEnabled
              ? ', streamed over HTTPS via Real-Debrid.'
              : ', streamed peer-to-peer via WebTorrent.'}
          </p>
        )}
      </div>
    </div>
  );
}
