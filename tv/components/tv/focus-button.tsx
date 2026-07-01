'use client';

import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';
import { Focusable } from './focusable';

interface Props {
  label: string;
  Icon?: LucideIcon;
  onEnterPress: () => void;
  variant?: 'primary' | 'ghost';
  autoFocus?: boolean;
  focusKey?: string;
  className?: string;
}

/** A remote-friendly button. Primary = solid white CTA; ghost = translucent. */
export function FocusButton({
  label,
  Icon,
  onEnterPress,
  variant = 'ghost',
  autoFocus,
  focusKey,
  className,
}: Props) {
  return (
    <Focusable
      ariaLabel={label}
      onEnterPress={onEnterPress}
      autoFocus={autoFocus}
      focusKey={focusKey}
      className={clsx('inline-block', className)}
    >
      {(focused) => (
        <div
          className={clsx(
            'flex items-center gap-2.5 rounded-xl px-6 py-3 text-[0.9rem] font-medium transition-colors',
            variant === 'primary'
              ? focused
                ? 'bg-white text-base'
                : 'bg-white/90 text-base'
              : focused
                ? 'bg-white/20 text-white'
                : 'bg-white/10 text-zinc-200',
          )}
        >
          {Icon && <Icon className="h-5 w-5" strokeWidth={2.4} />}
          {label}
        </div>
      )}
    </Focusable>
  );
}
