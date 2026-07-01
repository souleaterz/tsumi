'use client';

import { Delete } from 'lucide-react';
import { clsx } from 'clsx';
import { Focusable, FocusSection } from './focusable';

const ROWS = [
  'ABCDEFG'.split(''),
  'HIJKLMN'.split(''),
  'OPQRSTU'.split(''),
  'VWXYZ0'.split(''),
  '123456789'.split(''),
];

interface Props {
  onKey: (ch: string) => void;
  onDelete: () => void;
  onSpace: () => void;
}

/** A D-pad navigable on-screen keyboard for Search. */
export function OnScreenKeyboard({ onKey, onDelete, onSpace }: Props) {
  return (
    <FocusSection focusKey="KEYBOARD" className="inline-flex flex-col gap-2">
      {ROWS.map((row, i) => (
        <div key={i} className="flex gap-2">
          {row.map((ch, j) => (
            <Key
              key={ch}
              label={ch}
              autoFocus={i === 0 && j === 0}
              onEnterPress={() => onKey(ch)}
            />
          ))}
        </div>
      ))}
      <div className="mt-1 flex gap-2">
        <Key label="Space" wide Icon onEnterPress={onSpace} text="Space" />
        <Key label="Delete" Icon onEnterPress={onDelete} node={<Delete className="h-5 w-5" />} />
      </div>
    </FocusSection>
  );
}

function Key({
  label,
  onEnterPress,
  wide,
  node,
  text,
  autoFocus,
}: {
  label: string;
  onEnterPress: () => void;
  wide?: boolean;
  Icon?: boolean;
  node?: React.ReactNode;
  text?: string;
  autoFocus?: boolean;
}) {
  return (
    <Focusable ariaLabel={label} onEnterPress={onEnterPress} autoFocus={autoFocus}>
      {(focused) => (
        <div
          className={clsx(
            'flex h-11 items-center justify-center rounded-lg text-[0.85rem] font-medium transition-colors',
            wide ? 'w-40' : 'w-11',
            focused ? 'bg-white text-base' : 'bg-white/8 text-zinc-200',
          )}
        >
          {node ?? text ?? label}
        </div>
      )}
    </Focusable>
  );
}
