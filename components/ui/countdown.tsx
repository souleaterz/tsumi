'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

interface CountdownProps {
  /** Unix seconds when the next episode airs (AniList `airingAt`). */
  airingAt: number;
  episode?: number;
  className?: string;
  /** "full" ticks every second with seconds shown; "compact" shows d/h/m. */
  variant?: 'full' | 'compact';
}

function parts(secondsUntil: number) {
  const d = Math.floor(secondsUntil / 86400);
  const h = Math.floor((secondsUntil % 86400) / 3600);
  const m = Math.floor((secondsUntil % 3600) / 60);
  const s = Math.floor(secondsUntil % 60);
  return { d, h, m, s };
}

/** Live countdown to the next episode's air time. */
export function Countdown({
  airingAt,
  episode,
  className = '',
  variant = 'full',
}: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // Tick every second for "full", every 30s for "compact" (cards).
    const interval = variant === 'full' ? 1000 : 30_000;
    const id = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(id);
  }, [variant]);

  const secondsUntil = airingAt - Math.floor(now / 1000);
  if (secondsUntil <= 0) {
    return (
      <span className={className}>
        {episode ? `Episode ${episode} ` : ''}aired
      </span>
    );
  }

  const { d, h, m, s } = parts(secondsUntil);

  if (variant === 'compact') {
    const text = d > 0 ? `${d}d ${h}h` : h > 0 ? `${h}h ${m}m` : `${m}m`;
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <Clock className="h-3 w-3" />
        {episode ? `EP ${episode} · ` : ''}
        {text}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 tabular-nums ${className}`}>
      <Clock className="h-4 w-4 text-accent" />
      {episode ? <span className="text-zinc-400">Episode {episode} in</span> : null}
      <span className="font-semibold text-white">
        {d > 0 && `${d}d `}
        {(d > 0 || h > 0) && `${h}h `}
        {`${m}m `}
        {`${s}s`}
      </span>
    </span>
  );
}
