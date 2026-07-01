/**
 * Ad configuration — Adsterra "native banner" ad units.
 *
 * An Adsterra native banner is delivered as a matched pair:
 *   <script async data-cfasync="false" src=".../<key>/invoke.js"></script>
 *   <div id="container-<key>"></div>
 * The invoke.js script reads its own `src` to learn the <key>, finds the ONE
 * element with id `container-<key>`, and fills it. Because it targets a single
 * DOM id, a given ad unit can only render ONCE per page — putting the same key
 * in two places on one page is a duplicate id and only the first fills. The
 * same key CAN be reused across different pages (home, browse, watch…).
 *
 * To show several ads on a SINGLE page you need several ad units — create more
 * "Native Banner" zones in the Adsterra dashboard, each gives you a new
 * key + invoke.js URL. Add them here (or via env) and the extra <AdSlot>s in
 * the pages light up automatically.
 */

export type AdUnit = {
  /** The zone key — the hex string in the invoke.js path and container id. */
  key: string;
  /** Full invoke.js URL Adsterra gave you for this zone. */
  src: string;
};

/**
 * Built-in ad units. The first is the Native Banner the site owner set up.
 * Add more objects here as you create more Adsterra zones, or override the
 * whole list at deploy time with NEXT_PUBLIC_ADSTERRA_UNITS (see below).
 */
const DEFAULT_UNITS: AdUnit[] = [
  {
    key: '6e2decfb1c36c5bca9bafcf8bfb8054f',
    src: 'https://pl30095882.effectivecpmnetwork.com/6e2decfb1c36c5bca9bafcf8bfb8054f/invoke.js',
  },
];

/**
 * Optional env override / extension. Format: comma-separated `key|src` pairs.
 *   NEXT_PUBLIC_ADSTERRA_UNITS="abc123|https://…/abc123/invoke.js,def456|https://…/def456/invoke.js"
 * When set, it REPLACES the built-in list, so you can manage every zone from
 * Vercel env vars without touching code.
 */
function parseEnvUnits(): AdUnit[] {
  const raw = process.env.NEXT_PUBLIC_ADSTERRA_UNITS;
  if (!raw) return [];
  return raw
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [key, src] = pair.split('|').map((s) => s.trim());
      return key && src ? { key, src } : null;
    })
    .filter((u): u is AdUnit => u !== null);
}

const envUnits = parseEnvUnits();

/** The active list of ad units, in placement order. */
export const AD_UNITS: AdUnit[] = envUnits.length ? envUnits : DEFAULT_UNITS;

/**
 * Master kill switch. Ads are on by default (units are baked in above). Set
 * NEXT_PUBLIC_ADS_DISABLED=true to turn every slot off site-wide (e.g. while
 * an Adsterra account is under review). Pro subscribers never see ads
 * regardless — that gate lives in <AdSlot>.
 */
export const adsEnabled =
  AD_UNITS.length > 0 && process.env.NEXT_PUBLIC_ADS_DISABLED !== 'true';

/** Look up the ad unit for a given placement index, cycling is NOT allowed. */
export function adUnitAt(index: number): AdUnit | undefined {
  return AD_UNITS[index];
}
