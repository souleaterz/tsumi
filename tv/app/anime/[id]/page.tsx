import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@shared/anilist/client';
import { getEpisodeMeta } from '@shared/stream/sources';
import { groupSeasons } from '@/lib/seasons';
import { ShowView } from '@/components/tv/show-view';

export const revalidate = 1800;

export default async function ShowPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const [media, meta] = await Promise.all([getAnimeDetail(id), getEpisodeMeta(id)]);
  if (!media) notFound();

  const seasons = groupSeasons(meta, media.episodes ?? undefined);

  return <ShowView media={media} seasons={seasons} />;
}
