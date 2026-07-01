import type { Metadata, Viewport } from 'next';
import { bebas, inter, notoJp } from '@/lib/fonts';
import { Providers } from '@/components/providers';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { AdLoader } from '@/components/ad-loader';
import { AdGuard } from '@/components/ad-guard';
import { DesktopTitleBar } from '@/components/desktop/title-bar';
import './globals.css';

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: 'Tsumi — Anime Streaming',
    template: '%s · Tsumi',
  },
  description:
    'Tsumi (罪) — a dark, cinematic anime streaming experience. Browse, track, and stream anime powered by live AniList data.',
  keywords: ['anime', 'streaming', 'tsumi', 'anilist', 'watch anime'],
  openGraph: {
    type: 'website',
    siteName: 'Tsumi',
    title: 'Tsumi — Anime Streaming',
    description:
      'A dark, cinematic anime streaming experience powered by live AniList data.',
    url: appUrl,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tsumi — Anime Streaming',
    description:
      'A dark, cinematic anime streaming experience powered by live AniList data.',
  },
};

export const viewport: Viewport = {
  themeColor: '#0A0A0F',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${inter.variable} ${notoJp.variable}`}
    >
      <body className="min-h-screen overflow-x-hidden">
        <AdGuard />
        <Providers>
          <DesktopTitleBar />
          <Navbar />
          <main className="relative">{children}</main>
          <Footer />
        </Providers>
        <AdLoader />
      </body>
    </html>
  );
}
