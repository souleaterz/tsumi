import { notFound } from 'next/navigation';
import { getAnimeDetail } from '@shared/anilist/client';
import { AboutView } from '@/components/tv/about-view';

export const revalidate = 1800;

export default async function AboutPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const media = await getAnimeDetail(id);
  if (!media) notFound();

  // Prefer AniList's trailer when it's a YouTube video (embeddable on the TV).
  const trailerId =
    media.trailer?.site?.toLowerCase() === 'youtube' && media.trailer.id ? media.trailer.id : null;

  return <AboutView media={media} trailerId={trailerId} />;
}
