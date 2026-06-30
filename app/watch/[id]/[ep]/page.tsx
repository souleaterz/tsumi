import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';
import { getAnimeDetail } from '@/lib/anilist/client';
import { resolveStreams, getEpisodeMeta } from '@/lib/stream/sources';
import { isProviderEnabled } from '@/lib/stream/provider';
import { bestTitle } from '@/lib/utils';
import { getProStatus, currentUserId } from '@/lib/subscription';
import { getUserRdKey } from '@/lib/settings';
import { getEpisodeSubs } from '@/lib/subs';
import { WatchExperience } from '@/components/watch/watch-experience';
import { EpisodeNav } from '@/components/watch/episode-nav';
import { AdSlot } from '@/components/ui/ad-slot';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string; ep: string };
  searchParams: { audio?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const media = await getAnimeDetail(Number(params.id));
  const t = media ? bestTitle(media.title) : 'Watch';
  return { title: `${t} — Episode ${params.ep}` };
}

export default async function WatchPage({ params, searchParams }: Props) {
  const id = Number(params.id);
  const ep = Number(params.ep);
  if (!Number.isFinite(id) || !Number.isFinite(ep) || ep < 1) notFound();

  // Default to Dub unless the viewer explicitly chose Sub.
  const wantDub = searchParams.audio !== 'sub';

  const userId = await currentUserId();
  const [media, epMeta, isPro, rdKey] = await Promise.all([
    getAnimeDetail(id),
    getEpisodeMeta(id),
    getProStatus(userId),
    getUserRdKey(userId),
  ]);
  if (!media) notFound();

  // BYO-key: reliable streaming needs the user's own Real-Debrid key. Without
  // it (and without the provider), Torrentio only yields WebTorrent magnets,
  // which rarely play — so prompt the user to add their key.
  const needsKey = !rdKey && !isProviderEnabled;

  // English subtitles via OpenSubtitles (opt-in, gated by OPENSUBTITLES_API_KEY).
  // Routed through /api/sub for CORS + SRT→VTT conversion.
  const subTitle = media.title.english || media.title.romaji || '';
  const externalSubs = await getEpisodeSubs(subTitle, ep);
  const subtitleTracks = externalSubs.map((s, i) => ({
    url: `/api/sub?url=${encodeURIComponent(s.url)}`,
    lang: externalSubs.length > 1 ? `English ${i + 1}` : 'English',
  }));

  const title = bestTitle(media.title);
  const romaji = media.title.romaji || media.title.english || undefined;
  // Romaji title gives the Nyaa fallback the best chance of matching releases.
  let resolved = await resolveStreams(id, ep, romaji, wantDub, rdKey ?? undefined);
  // If defaulting to dub found nothing (e.g. provider has no dub), fall to sub.
  if (resolved.length === 0 && wantDub && searchParams.audio !== 'dub') {
    resolved = await resolveStreams(id, ep, romaji, false, rdKey ?? undefined);
  }

  // Sanitise for the client: Real-Debrid sources carry a resolver URL with the
  // RD key — strip it and expose a keyless /api/stream-url endpoint instead.
  // Provider sources keep their own (already-English) subtitle tracks; we
  // attach external subs only to RD/torrent sources that don't have any.
  const sources = resolved.map((s) => {
    const { url, ...safe } = s;
    const withSubs =
      s.subtitles && s.subtitles.length > 0
        ? safe
        : { ...safe, subtitles: subtitleTracks };
    if (url) {
      return {
        ...withSubs,
        playUrl: `/api/stream-url/${id}/${ep}?t=${encodeURIComponent(s.title)}`,
      };
    }
    return withSubs;
  });

  const cover = media.coverImage?.extraLarge || media.coverImage?.large || undefined;
  const totalEpisodes = media.episodes ?? epMeta.length ?? 1;
  const epInfo = epMeta.find((e) => e.episode === ep);

  // All quality tiers are available to everyone — HD sources are usually the
  // best-seeded / cached ones, so capping free users only hurt performance.
  // With a provider, dub is fetched on demand, so always offer the toggle.
  // Otherwise, only offer Dub when a dub-capable (dual-audio) release was found.
  const hasDub = isProviderEnabled || sources.some((s) => s.dub);
  // Effective choice: honour explicit Sub; default to Dub only when available.
  const audioPref: 'sub' | 'dub' =
    searchParams.audio === 'sub' || !hasDub ? 'sub' : 'dub';
  const availableSources =
    audioPref === 'dub' && sources.some((s) => s.dub)
      ? sources.filter((s) => s.dub)
      : sources;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Breadcrumb */}
      <Link
        href={`/anime/${id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 transition hover:text-accent"
      >
        <ChevronLeft className="h-4 w-4" /> Back to {title}
      </Link>

      {/* BYO-key prompt — streaming needs the user's own Real-Debrid key. */}
      {needsKey && (
        <div className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-zinc-200">
          <p className="font-semibold text-white">Add your Real-Debrid key to stream</p>
          <p className="mt-1 text-zinc-300">
            Tsumi streams through your own Real-Debrid account. Paste your API key
            on your profile once and every episode plays over fast HTTPS.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-block rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary/80"
          >
            Add Real-Debrid key →
          </Link>
        </div>
      )}

      {/* Player */}
      <WatchExperience
        anilistId={id}
        episode={ep}
        title={title}
        coverImage={cover}
        totalEpisodes={totalEpisodes}
        sources={availableSources}
        isPro={isPro}
        preferDub={audioPref === 'dub'}
      />

      {/* Title + nav */}
      <div className="mt-5 flex flex-col gap-4">
        <div>
          <span className="katakana text-[10px]">エピソード {ep}</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <h1 className="text-3xl text-white sm:text-4xl">
              {title}
              <span className="ml-3 text-accent">EP {ep}</span>
            </h1>
          </div>
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
            {rdKey
              ? ', streamed over HTTPS via Real-Debrid.'
              : ', streamed peer-to-peer via WebTorrent.'}
          </p>
        )}

        {/* Ad slot — below the player + episode metadata. */}
        <AdSlot slot="watch-banner" />
      </div>
    </div>
  );
}
