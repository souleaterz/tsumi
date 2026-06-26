import type { MetadataRoute } from 'next';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Keep private/transient routes out of the index.
      disallow: ['/profile', '/watch/', '/api/', '/sign-in', '/sign-up'],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
