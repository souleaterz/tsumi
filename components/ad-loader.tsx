import Script from 'next/script';

/**
 * Injects the ad network's loader script into the root layout when configured.
 * Set `NEXT_PUBLIC_AD_SCRIPT` to the network's script URL (e.g. AdSense
 * `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?...`).
 * The loader then scans the page for <AdSlot> divs and fills them.
 *
 * For AdSense specifically, also set `NEXT_PUBLIC_ADSENSE_CLIENT` to your
 * `ca-pub-…` ID so `<AdSlot>` can render the `<ins>` element AdSense expects.
 */
export function AdLoader() {
  const src = process.env.NEXT_PUBLIC_AD_SCRIPT;
  if (!src) return null;
  return (
    <Script
      src={src}
      strategy="lazyOnload"
      crossOrigin="anonymous"
    />
  );
}
