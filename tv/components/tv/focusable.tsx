'use client';

import { forwardRef, useEffect, type ReactNode } from 'react';
import {
  useFocusable,
  FocusContext,
} from '@noriginmedia/norigin-spatial-navigation';
import { clsx } from 'clsx';

type ScrollOpt = boolean | ScrollIntoViewOptions;

function scrollInto(node: HTMLElement | null, opt: ScrollOpt) {
  if (!node || !opt) return;
  node.scrollIntoView({
    // Instant, not smooth: the spatial-navigation library measures element
    // positions with getBoundingClientRect on each D-pad move. A smooth-scroll
    // animation left the neighbours mid-flight, so rapid presses would land two
    // cells over (the "skips every second poster" bug). Snapping keeps geometry
    // stable — and instant snap is the norm for TV grids anyway.
    behavior: 'auto',
    block: 'nearest',
    inline: 'center',
    ...(typeof opt === 'object' ? opt : {}),
  });
}

interface FocusableProps {
  onEnterPress?: () => void;
  onFocus?: () => void;
  focusKey?: string;
  className?: string;
  /** Extra classes applied only while focused (on top of the default ring). */
  focusClassName?: string;
  children: ReactNode | ((focused: boolean) => ReactNode);
  disabled?: boolean;
  ariaLabel?: string;
  /** Scroll into view when focused — use for rail cards / long lists. */
  scrollOnFocus?: ScrollOpt;
  /** Auto-focus this element on mount (e.g. the first item on a page). */
  autoFocus?: boolean;
  /**
   * Render no default focus visual — the child fully owns its focused look via
   * the render-prop `focused` flag. Used by PosterCard so the white box hugs
   * just the artwork, not the title beneath it.
   */
  bare?: boolean;
}

/**
 * A single focusable leaf. Renders a div (tabbable via tabIndex). When the D-pad
 * lands on it, it draws a clean white box slightly larger than the element (no
 * zoom, no warp) and fires onEnterPress on the remote's select/Enter.
 */
export function Focusable({
  onEnterPress,
  onFocus,
  focusKey,
  className,
  focusClassName,
  children,
  disabled,
  ariaLabel,
  scrollOnFocus,
  autoFocus,
  bare,
}: FocusableProps) {
  const { ref, focused, focusSelf } = useFocusable<object, HTMLDivElement>({
    focusKey,
    focusable: !disabled,
    onEnterPress: () => onEnterPress?.(),
    onFocus: () => {
      scrollInto(ref.current, scrollOnFocus ?? false);
      onFocus?.();
    },
  });

  useEffect(() => {
    if (autoFocus) focusSelf();
    // Focus once on mount; focusSelf identity is stable per hook instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="button"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={clsx(
        'cursor-pointer rounded-xl',
        // A white box slightly larger than the element — the outline sits a few
        // px outside the border and follows the rounded corners. No transform,
        // so nothing warps.
        !bare && focused && 'outline outline-[3px] outline-white [outline-offset:4px]',
        focused && focusClassName,
        className,
      )}
    >
      {typeof children === 'function' ? children(focused) : children}
    </div>
  );
}

interface FocusSectionProps {
  focusKey?: string;
  className?: string;
  children: ReactNode;
  /** Remember the last focused child when focus returns to this section. */
  saveLastFocusedChild?: boolean;
}

/**
 * A group of focusables (a rail, the sidebar, a grid). Provides its focusKey to
 * descendants via context so spatial navigation treats them as one region and
 * can restore the last focused child.
 */
export const FocusSection = forwardRef<HTMLDivElement, FocusSectionProps>(
  function FocusSection({ focusKey, className, children, saveLastFocusedChild = true }, _ref) {
    const { ref, focusKey: fk } = useFocusable<object, HTMLDivElement>({
      focusKey,
      trackChildren: true,
      saveLastFocusedChild,
    });
    return (
      <FocusContext.Provider value={fk}>
        <div ref={ref} className={className}>
          {children}
        </div>
      </FocusContext.Provider>
    );
  },
);
