'use client';

import { useEffect, useState } from 'react';
import { Download, MonitorPlay } from 'lucide-react';
import { isDesktop } from '@/lib/desktop';

// Where the "Download" button points. Configurable so it can target the public
// GitHub release, a CDN-hosted installer, or a dedicated download page later.
const DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_APP_DOWNLOAD_URL ||
  'https://github.com/souleaterz/tsumi/releases/latest';

interface Props {
  anilistId: number;
  episode: number;
}

/**
 * Website-only banner above the player nudging viewers to the desktop app,
 * where playback is smooth (native mpv, no Real-Debrid transcode).
 *
 * "Open in app" attempts the `tsumi://` deep link; if the app isn't installed
 * (the tab never loses focus), it falls back to the download page — so the one
 * button means "open if installed, otherwise download". Renders nothing inside
 * the Electron shell, which has its own native source picker.
 */
export function AppPromoBar({ anilistId, episode }: Props) {
  const [show, setShow] = useState(false);

  useEffect(() => setShow(!isDesktop()), []);
  if (!show) return null;

  const openInApp = () => {
    const deepLink = `tsumi://watch/${anilistId}/${episode}`;
    // If the OS hands the URL to the installed app, this tab loses visibility/
    // focus. If it's still visible ~1.2s later, assume the app isn't installed
    // and send the user to the download page instead.
    let switched = false;
    const markSwitched = () => {
      if (document.visibilityState === 'hidden') switched = true;
    };
    document.addEventListener('visibilitychange', markSwitched);
    window.addEventListener('blur', () => (switched = true), { once: true });

    window.location.href = deepLink;

    window.setTimeout(() => {
      document.removeEventListener('visibilitychange', markSwitched);
      if (!switched && document.visibilityState === 'visible') {
        window.open(DOWNLOAD_URL, '_blank', 'noopener');
      }
    }, 1200);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent/30 bg-accent/10 p-3">
      <div className="flex items-center gap-2 text-sm text-zinc-200">
        <MonitorPlay className="h-4 w-4 shrink-0 text-accent" />
        <span>
          <span className="font-semibold text-white">Watch smoother in the app.</span>{' '}
          The Tsumi desktop app streams natively — no buffering, no transcoding.
        </span>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={openInApp}
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-[#0A0A0F] transition hover:bg-accent/80"
        >
          <MonitorPlay className="h-4 w-4" />
          Open in app
        </button>
        <a
          href={DOWNLOAD_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1.5 text-xs text-zinc-300 transition hover:text-accent"
        >
          <Download className="h-3.5 w-3.5" />
          Download
        </a>
      </div>
    </div>
  );
}
