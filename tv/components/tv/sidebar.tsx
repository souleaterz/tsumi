'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Home, Search, LayoutGrid, Film, Compass, Bookmark, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { Focusable, FocusSection } from './focusable';

const NAV = [
  { href: '/', label: 'Home', jp: 'ホーム', Icon: Home },
  { href: '/search', label: 'Search', jp: '検索', Icon: Search },
  { href: '/browse', label: 'Browse', jp: '一覧', Icon: LayoutGrid },
  { href: '/movies', label: 'Movies', jp: '映画', Icon: Film },
  { href: '/discover', label: 'Discover', jp: '発見', Icon: Compass },
  { href: '/my-list', label: 'My list', jp: 'リスト', Icon: Bookmark },
  { href: '/settings', label: 'Settings', jp: '設定', Icon: Settings },
] as const;

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(href + '/');
}

/**
 * The persistent left rail. Its items are focusable; pressing the remote's
 * select navigates. The active page keeps a steady purple highlight, distinct
 * from the bright focus ring that tracks the D-pad.
 */
export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <FocusSection
      focusKey="SIDEBAR"
      className="flex h-full w-[13vw] min-w-[150px] max-w-[220px] shrink-0 flex-col border-r border-white/5 bg-[#100e18] px-3 py-6"
    >
      <div className="mb-8 flex items-center gap-2 px-2">
        <span className="font-jp text-3xl text-accent">罪</span>
        <span className="font-heading text-2xl tracking-[0.18em] text-white">TSUMI</span>
      </div>

      <nav className="flex flex-col gap-1.5">
        {NAV.map(({ href, label, jp, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Focusable
              key={href}
              ariaLabel={label}
              onEnterPress={() => {
                // Don't stack a duplicate entry for the section we're already on
                // — that just adds dead presses on the way back out.
                if (!active) router.push(href);
              }}
              className="!rounded-xl"
            >
              {(focused) => (
                <div
                  className={clsx(
                    'flex items-center gap-3 rounded-xl px-4 py-3 transition-colors',
                    active
                      ? 'bg-primary text-white'
                      : focused
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400',
                  )}
                >
                  <Icon className="h-6 w-6 shrink-0" strokeWidth={2} />
                  <span className="flex flex-col leading-none">
                    <span className="text-[0.9rem] font-medium">{label}</span>
                    <span className="font-jp mt-1 text-[0.6rem] tracking-widest text-current opacity-50">
                      {jp}
                    </span>
                  </span>
                </div>
              )}
            </Focusable>
          );
        })}
      </nav>

      <div className="mt-auto px-2">
        <span className="katakana text-[0.55rem]">リビングでアニメ</span>
      </div>
    </FocusSection>
  );
}
