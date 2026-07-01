'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { getMyList, subscribeMyList, type MyListItem } from '@/lib/mylist';
import { PageTitle } from '@/components/tv/page-title';
import { Focusable, FocusSection } from '@/components/tv/focusable';

export default function MyListPage() {
  const router = useRouter();
  const [items, setItems] = useState<MyListItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const load = () => {
      setItems(getMyList());
      setReady(true);
    };
    load();
    return subscribeMyList(load);
  }, []);

  return (
    <div>
      <PageTitle title="My list" jp="リスト" />
      {ready && items.length === 0 ? (
        <p className="px-[var(--tv-safe)] py-10 text-zinc-500">
          Nothing saved yet. Open a show and choose “My list” to keep it here.
        </p>
      ) : (
        <FocusSection className="grid grid-cols-6 gap-x-4 gap-y-6 px-[var(--tv-safe)] pb-16">
          {items.map((m, i) => (
            <Focusable
              key={m.id}
              bare
              scrollOnFocus
              autoFocus={i === 0}
              ariaLabel={m.title}
              onEnterPress={() => router.push(`/anime/${m.id}`)}
            >
              {(focused) => (
                <div>
                  <div
                    className={clsx(
                      'relative aspect-[2/3] w-full overflow-hidden rounded-xl border bg-surface',
                      focused ? 'border-transparent outline outline-[3px] outline-white [outline-offset:4px]' : 'border-white/10',
                    )}
                  >
                    {m.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={m.cover} alt={m.title} className="h-full w-full object-cover" />
                    )}
                  </div>
                  <p className={clsx('mt-2 truncate text-[0.8rem]', focused ? 'text-white' : 'text-zinc-300')}>
                    {m.title}
                  </p>
                </div>
              )}
            </Focusable>
          ))}
        </FocusSection>
      )}
    </div>
  );
}
