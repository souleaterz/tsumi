'use client';

import { useEffect, useState } from 'react';
import { Minus, Square, Copy, X } from 'lucide-react';
import { isDesktop, desktop } from '@/lib/desktop';

/**
 * Custom window title bar for the frameless Electron shell.
 *
 * The desktop window is frameless (no OS title bar / menu strip) for an
 * app-like, full-bleed look — so we draw our own slim draggable bar with the
 * minimise / maximise / close controls. In a normal browser `isDesktop()` is
 * false and this renders nothing, leaving the website untouched.
 *
 * It's `fixed` at the top; we push the document down by its height and offset
 * the sticky navbar via the `--tsumi-nav-top` CSS variable so nothing hides
 * behind it.
 */
const BAR_PX = 32;

export function DesktopTitleBar() {
  const [show, setShow] = useState(false);
  const [maximized, setMaximized] = useState(true);

  useEffect(() => {
    if (!isDesktop()) return;
    setShow(true);
    // Reserve space for the fixed bar + offset the sticky navbar beneath it.
    document.body.style.paddingTop = `${BAR_PX}px`;
    document.documentElement.style.setProperty('--tsumi-nav-top', `${BAR_PX}px`);
    const off = desktop()?.onMaximizeChange(setMaximized);
    return () => {
      off?.();
      document.body.style.paddingTop = '';
      document.documentElement.style.removeProperty('--tsumi-nav-top');
    };
  }, []);

  if (!show) return null;

  const bridge = desktop();

  return (
    <div
      className="fixed inset-x-0 top-0 z-[100] flex h-8 items-center justify-between border-b border-white/5 bg-base/95 backdrop-blur"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      onDoubleClick={() => bridge?.toggleMaximize()}
    >
      {/* Brand */}
      <div className="flex select-none items-center gap-2 px-3">
        <span className="font-jp text-sm leading-none text-primary">罪</span>
        <span className="font-heading text-sm tracking-widest text-zinc-200">
          TSUMI
        </span>
      </div>

      {/* Window controls — opt out of the drag region so they're clickable. */}
      <div
        className="flex h-full"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={() => bridge?.minimize()}
          aria-label="Minimise"
          className="flex h-full w-11 items-center justify-center text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => bridge?.toggleMaximize()}
          aria-label={maximized ? 'Restore' : 'Maximise'}
          className="flex h-full w-11 items-center justify-center text-zinc-400 transition hover:bg-white/10 hover:text-white"
        >
          {maximized ? (
            <Copy className="h-3 w-3 -scale-x-100" />
          ) : (
            <Square className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={() => bridge?.closeWindow()}
          aria-label="Close"
          className="flex h-full w-11 items-center justify-center text-zinc-400 transition hover:bg-action hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
