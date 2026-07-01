import type { Metadata, Viewport } from 'next';
import { bebas, inter, notoJp } from '@/lib/fonts';
import { SpatialInit } from '@/components/tv/spatial-init';
import { Sidebar } from '@/components/tv/sidebar';
import './globals.css';

export const metadata: Metadata = {
  title: 'Tsumi TV',
  description: 'Tsumi (罪) for the big screen — anime streaming for Fire TV.',
};

// Pin a fixed 10-foot layout width instead of device-width. On a Firestick the
// WebView reports a ~960px device-width (1080p @ density 2), so a device-width
// layout gets scaled ~2x to fill the screen — everything looks zoomed in. A
// fixed 1280px viewport (with the shell's loadWithOverviewMode) maps the design
// to more CSS pixels and lets the WebView scale it to fill at ~1.5x: smaller,
// sharper, and correctly sized for the couch.
export const viewport: Viewport = {
  themeColor: '#0A0A0F',
  width: 1280,
};

// The TV app has its OWN root layout — a fixed sidebar + scrolling content
// stage — deliberately separate from the website's navbar/footer chrome.
export default function TvRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bebas.variable} ${inter.variable} ${notoJp.variable}`}
    >
      <body>
        <SpatialInit />
        <div className="flex h-screen w-screen overflow-hidden bg-base">
          <Sidebar />
          <main className="relative h-full flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
