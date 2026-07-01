'use client';

import { useEffect } from 'react';
import { init } from '@noriginmedia/norigin-spatial-navigation';

// Initialise Norigin spatial navigation once on the client. This wires the
// arrow keys / D-pad and Enter into focus movement across every element that
// registers with useFocusable(). Runs in a layout effect so it's ready before
// the first page paints its focusable content.
let started = false;

export function SpatialInit() {
  useEffect(() => {
    if (started) return;
    started = true;
    init({
      // Geometric focus movement (works for our sidebar + rails layout).
      debug: false,
      visualDebug: false,
      // Measure every candidate's live rect at each keypress instead of trusting
      // cached layout. Without this, once a scroll container has moved the focused
      // element gets re-measured fresh while its neighbours stay stale, and the
      // mismatch makes the D-pad jump two cells over — the "skips every second
      // poster" bug on the Browse grid.
      useGetBoundingClientRect: true,
      // Let the browser's native focus follow too (screen readers, predictable
      // DOM focus)…
      shouldFocusDOMNode: true,
      // …but never let that native focus scroll the page. WE own scrolling via
      // scrollIntoView; the browser's extra focus-scroll is what made the whole
      // screen lurch on plain left/right moves.
      domNodeFocusOptions: { preventScroll: true },
      // Don't scroll the whole document — rails/sections manage their own
      // scrollIntoView on focus.
      shouldUseNativeEvents: false,
    });
  }, []);

  return null;
}
