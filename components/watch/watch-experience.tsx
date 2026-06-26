'use client';

import { useEffect, useState } from 'react';
import type { StreamSource } from '@/lib/stream/sources';
import { VidstackPlayer } from './vidstack-player';
import { PreRollAd } from './preroll-ad';
import { getEpisodeProgress } from '@/lib/progress';
import { useUserId } from '@/lib/auth/use-user-id';

interface Props {
  anilistId: number;
  episode: number;
  title: string;
  coverImage?: string;
  totalEpisodes?: number;
  sources: StreamSource[];
  isPro?: boolean;
}

/**
 * Orchestrates the watch flow: free-tier users get a pre-roll ad gate,
 * Pro users go straight to the player. Looks up any saved position so
 * playback resumes where the viewer left off.
 */
export function WatchExperience({ isPro = false, ...playerProps }: Props) {
  const [adDone, setAdDone] = useState(isPro);
  const [startAt, setStartAt] = useState(0);
  const { userId, isLoaded } = useUserId();

  useEffect(() => {
    if (!isLoaded) return;
    getEpisodeProgress(playerProps.anilistId, playerProps.episode, userId).then((p) => {
      if (p && !p.completed) setStartAt(p.positionSec);
    });
  }, [playerProps.anilistId, playerProps.episode, isLoaded, userId]);

  if (!adDone) {
    return <PreRollAd onComplete={() => setAdDone(true)} />;
  }

  return <VidstackPlayer {...playerProps} userId={userId} startAt={startAt} />;
}
