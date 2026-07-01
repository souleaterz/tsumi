import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@shared/anilist/client';
import { displayTitle } from '@/lib/format';
import { WatchTV } from '@/components/tv/watch-tv';

export const revalidate = 0;

export default async function WatchPage({ params }: { params: { id: string; ep: string } }) {
  const id = Number(params.id);
  const ep = Number(params.ep);
  if (!Number.isFinite(id) || !Number.isFinite(ep)) notFound();

  const media = await getAnimeDetail(id);
  if (!media) notFound();

  return (
    <WatchTV
      anilistId={id}
      episode={ep}
      title={media.title.romaji || displayTitle(media)}
      coverImage={media.bannerImage || media.coverImage?.extraLarge || undefined}
      totalEpisodes={media.episodes ?? undefined}
      idMal={media.idMal ?? undefined}
      durationSec={media.duration ? media.duration * 60 : undefined}
    />
  );
}
