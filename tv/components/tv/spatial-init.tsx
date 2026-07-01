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
      // Let the browser's native focus follow too, so screen readers and the
      // scrollIntoView we trigger on focus behave predictably.
      shouldFocusDOMNode: true,
      // Don't scroll the whole document — rails/sections manage their own
      // scrollIntoView on focus.
      shouldUseNativeEvents: false,
    });
  }, []);

  return null;
}
