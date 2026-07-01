import Script from 'next/script';
import { AD_UNITS, adsEnabled } from '@/lib/ads';

/**
 * Popunder blocker.
 *
 * The Adsterra ad unit serves BOTH a native banner and a popunder, and we only
 * want the banner. The two use different mechanisms:
 *   • the native banner is injected into our `#container-<key>` div (DOM), while
 *   • the popunder fires a `window.open()` (usually on the first page click).
 *
 * So we wrap `window.open` and cancel only the calls whose JS call-stack traces
 * back to an ad-network script. Every other `window.open` — our app-download
 * button, Clerk/Stripe auth popups, anything the site itself opens — passes
 * through untouched, because their stacks don't reference the ad domains.
 *
 * Runs `beforeInteractive` so the wrapper is in place before the invoke.js
 * script is ever injected (and before it can cache a reference to window.open).
 *
 * NOTE: this is a best-effort client guard. Adsterra rotates popunder domains,
 * so the truly reliable fix is to serve the banner from a *Native Banner* zone
 * that has no popunder attached (create one in the Adsterra dashboard). This
 * covers the common case in the meantime.
 */
export function AdGuard() {
  if (!adsEnabled) return null;

  // Hostnames of our configured invoke.js scripts, plus well-known Adsterra
  // popunder/redirect domains. Any window.open whose stack mentions one of
  // these is treated as a popunder and blocked.
  const hosts = AD_UNITS.map((u) => {
    try {
      return new URL(u.src).hostname;
    } catch {
      return '';
    }
  }).filter(Boolean);

  const patterns = Array.from(
    new Set([
      ...hosts,
      'effectivecpmnetwork',
      'effectivegatecpm',
      'highperformanceformat',
      'profitabledisplaynetwork',
      'displaycontentnetwork',
      'adsterra',
      'invoke.js',
    ]),
  ).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  const re = patterns.join('|');

  const js = `(function(){try{
    var re=/(${re})/i;
    var real=window.open.bind(window);
    window.__tsumiRealOpen=real;
    window.open=function(){
      try{
        var stack=(new Error()).stack||'';
        var url=String(arguments[0]||'');
        if(re.test(stack)||re.test(url)){return null;}
      }catch(e){}
      return real.apply(window,arguments);
    };
  }catch(e){}})();`;

  return (
    <Script id="tsumi-ad-guard" strategy="beforeInteractive">
      {js}
    </Script>
  );
}
