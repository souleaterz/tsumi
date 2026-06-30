'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ClerkAuthButtons } from './auth-buttons';
import { SearchAutocomplete } from './search-autocomplete';

const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const NAV_LINKS = [
  { href: '/', label: 'Home', jp: 'ホーム' },
  { href: '/browse', label: 'Browse', jp: 'ブラウズ' },
  { href: '/profile', label: 'My List', jp: 'リスト' },
];

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <header
      className="sticky z-50 border-b border-white/5 bg-base/70 backdrop-blur-xl"
      style={{ top: 'var(--tsumi-nav-top, 0px)' }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-2">
          <span className="font-jp text-2xl text-primary transition group-hover:text-accent">
            罪
          </span>
          <span className="font-heading text-2xl tracking-widest text-white text-glow">
            TSUMI
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => {
            const active =
              link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'group relative rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active ? 'text-white' : 'text-zinc-400 hover:text-white',
                )}
              >
                {link.label}
                <span className="katakana absolute -top-1 left-3 text-[7px]">
                  {link.jp}
                </span>
                {active && (
                  <span className="absolute inset-x-2 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="flex-1" />

        {/* Search */}
        <SearchAutocomplete className="hidden w-56 sm:block" />

        {/* Auth */}
        <div className="hidden items-center gap-3 md:flex">
          {hasClerk ? (
            <ClerkAuthButtons />
          ) : (
            <Link
              href="/profile"
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white shadow-glow transition hover:bg-primary/90"
            >
              Get Started
            </Link>
          )}
        </div>

        {/* Mobile toggle */}
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-zinc-300 md:hidden"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/5 bg-base/95 px-4 py-4 md:hidden">
          <SearchAutocomplete className="mb-4" />
          <div className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5 hover:text-white"
              >
                {link.label} <span className="katakana ml-2 text-[9px]">{link.jp}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </header>
  );
}
