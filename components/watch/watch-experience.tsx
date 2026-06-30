'use client';

import { useEffect, useState } from 'react';
import type { StreamSource } from '@/lib/stream/sources';
import { VidstackPlayer } from './vidstack-player';
import { DesktopWatch } from './desktop-watch';
import { AppPromoBar } from './app-promo-bar';
import { PreRollAd } from './preroll-ad';
import { getEpisodeProgress } from '@/lib/progress';
import { useUserId } from '@/lib/auth/use-user-id';
import { isDesktop } from '@/lib/desktop';

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  sources: StreamSource[];
  isPro?: boolean;
  preferDub?: boolean;
  /** MyAnimeList id — used to fetch AniSkip intro/outro times (desktop). */
  idMal?: number | null;
  /** Episode runtime in seconds — improves AniSkip matching + end detection. */
  durationSec?: number;
}

/**
 * Orchestrates the watch flow and splits the two products:
 *
 *  • Desktop app → native Stremio-style source picker that plays in mpv
 *    (smooth, no transcode). No pre-roll gate; playback is native.
 *  • Website → pre-roll ad gate (free tier) then the in-browser player, with a
 *    banner nudging viewers to the smoother desktop app.
 *
 * Either way we look up any saved position so playback resumes where the
 * viewer left off.
 */
export function WatchExperience({
  isPro = false,
  idMal,
  durationSec,
  ...playerProps
}: Props) {
  const [adDone, setAdDone] = useState(isPro);
  const [startAt, setStartAt] = useState(0);
  const { userId, isLoaded } = useUserId();
  // null until mounted — avoids SSR/first-paint mismatch and a flash of the
  // browser player inside the desktop shell.
  const [mode, setMode] = useState<'web' | 'desktop' | null>(null);

  useEffect(() => setMode(isDesktop() ? 'desktop' : 'web'), []);

  useEffect(() => {
    if (!isLoaded) return;
    getEpisodeProgress(playerProps.anilistId, playerProps.episode, userId).then((p) => {
      if (p && !p.completed) setStartAt(p.positionSec);
    });
  }, [playerProps.anilistId, playerProps.episode, isLoaded, userId]);

  if (mode === null) {
    return (
      <div className="aspect-video w-full animate-pulse rounded-xl border border-white/10 bg-surface/40" />
    );
  }

  if (mode === 'desktop') {
    return (
      <DesktopWatch
        {...playerProps}
        idMal={idMal}
        durationSec={durationSec}
        userId={userId}
        startAt={startAt}
      />
    );
  }

  if (!adDone) {
    return <PreRollAd onComplete={() => setAdDone(true)} />;
  }

  return (
    <>
      <AppPromoBar anilistId={playerProps.anilistId} episode={playerProps.episode} />
      <VidstackPlayer {...playerProps} userId={userId} startAt={startAt} />
    </>
  );
}
