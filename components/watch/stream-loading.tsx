'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Anime title — rendered big in the centre as the "loading bar". */
  title: string;
  /** Cover art shown greyed-out in the background. */
  coverImage?: string;
  /**
   * Real progress 0–100. Leave undefined for an indeterminate stream (most
   * direct/torrent connects have no meaningful percent) — the fill then creeps
   * forward on its own so the screen always feels alive.
   */
  progress?: number;
  /** Status line under the title (e.g. "Connecting to peers…"). */
  label?: string;
}

/**
 * The stream-loading hero. Instead of a bare spinner on black, we show the
 * episode's cover art greyed-out behind the anime title — and the title itself
 * IS the loading bar: it starts dull and brightens left-to-right as the stream
 * loads, with a glowing leading edge riding the fill.
 *
 * Determinate when `progress` is supplied; otherwise an eased creep toward ~90%
 * keeps it moving until the player flips to ready and this overlay unmounts.
 */
export function StreamLoading({ title, coverImage, progress, label }: Props) {
  // Smoothly-animated fill percentage. We ease toward the target every frame so
  // both real progress jumps and the indeterminate creep look fluid.
  const [pct, setPct] = useState(0);
  const targetRef = useRef<number | undefined>(progress);
  targetRef.current = progress;

  useEffect(() => {
    let v = 0;
    let raf = 0;
    const loop = () => {
      const target = targetRef.current;
      if (target == null) {
        // Indeterminate: asymptotically approach 90% — never quite arrives.
        v += (90 - v) * 0.012;
      } else {
        v += (Math.max(0, Math.min(100, target)) - v) * 0.08;
      }
      setPct(v);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const shown = Math.round(pct);

  return (
    <div className="absolute inset-0 z-30 overflow-hidden">
      {/* Greyed-out cover art backdrop */}
      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverImage}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-[3px] brightness-[0.22] grayscale"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/90 to-base/70" />
      <div className="grain absolute inset-0" />

      {/* Centre: the title-as-loading-bar */}
      <div className="relative flex h-full flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative inline-block max-w-4xl">
          {/* Dull base layer */}
          <h2 className="font-heading text-3xl leading-tight tracking-wide text-white/[0.12] sm:text-5xl lg:text-6xl">
            {title}
          </h2>
          {/* Bright fill, revealed left-to-right by the progress clip */}
          <h2
            aria-hidden
            className="text-glow absolute inset-0 font-heading text-3xl leading-tight tracking-wide text-white sm:text-5xl lg:text-6xl"
            style={{ clipPath: `inset(0 ${100 - pct}% 0 0)` }}
          >
            {title}
          </h2>
          {/* Glowing leading edge riding the fill */}
          <div
            className="pointer-events-none absolute inset-y-0 w-[2px] bg-accent shadow-glow-accent transition-opacity"
            style={{ left: `${pct}%`, opacity: pct > 0.5 && pct < 99.5 ? 1 : 0 }}
          />
        </div>

        {/* Status line + percent */}
        <div className="flex flex-col items-center gap-1.5">
          {label && <p className="text-sm text-zinc-300">{label}</p>}
          <p className="font-heading text-lg tracking-[0.2em] text-accent/80">
            {shown}%
          </p>
          <span className="katakana text-[10px]">ストリーミング準備中</span>
        </div>
      </div>
    </div>
  );
}
