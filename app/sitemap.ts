import type { MetadataRoute } from 'next';
import { getTrending } from '@/lib/anilist/client';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const revalidate = 86400;

/**
 * Sitemap: static routes plus the current trending anime detail pages so they
 * get discovered. Detail/watch pages are otherwise crawlable via internal links.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: appUrl, changeFrequency: 'daily', priority: 1 },
    { url: `${appUrl}/browse`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${appUrl}/profile`, changeFrequency: 'weekly', priority: 0.3 },
  ];

  let animeRoutes: MetadataRoute.Sitemap = [];
  try {
    const trending = await getTrending(40);
    animeRoutes = trending.map((m) => ({
      url: `${appUrl}/anime/${m.id}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    }));
  } catch {
    // AniList unavailable — ship the static routes only.
  }

  return [...staticRoutes, ...animeRoutes];
}
