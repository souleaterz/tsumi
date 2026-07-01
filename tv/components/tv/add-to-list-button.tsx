'use client';

import { useEffect, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { clsx } from 'clsx';
import { isInList, toggleMyList, subscribeMyList, type MyListItem } from '@/lib/mylist';
import { Focusable } from './focusable';

/** Toggle a title in My List. Reflects live membership state. */
export function AddToListButton({ item, autoFocus }: { item: MyListItem; autoFocus?: boolean }) {
  const [inList, setInList] = useState(false);

  useEffect(() => {
    setInList(isInList(item.id));
    return subscribeMyList(() => setInList(isInList(item.id)));
  }, [item.id]);

  return (
    <Focusable
      ariaLabel={inList ? 'Remove from my list' : 'Add to my list'}
      autoFocus={autoFocus}
      onEnterPress={() => setInList(toggleMyList(item))}
    >
      {(focused) => (
        <div
          className={clsx(
            'flex items-center gap-2.5 rounded-xl px-6 py-3 text-[0.9rem] font-medium transition-colors',
            focused ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-200',
          )}
        >
          {inList ? <Check className="h-5 w-5 text-accent" /> : <Plus className="h-5 w-5" />}
          {inList ? 'In my list' : 'My list'}
        </div>
      )}
    </Focusable>
  );
}
