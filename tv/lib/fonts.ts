import { Bebas_Neue, Inter, Noto_Sans_JP } from 'next/font/google';

// next/font must be initialised inside the app that uses it, so the TV app
// keeps its own copy (identical to the main site's lib/fonts.ts).
export const bebas = Bebas_Neue({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-bebas',
  display: 'swap',
});

export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const notoJp = Noto_Sans_JP({
  weight: ['400', '500'],
  subsets: ['latin'],
  variable: '--font-jp',
  display: 'swap',
  preload: false,
});
