import Link from 'next/link';

export function Footer() {
  return (
    <footer className="relative mt-24 border-t border-white/5 bg-base">
      <div className="grain pointer-events-none absolute inset-0" />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <span className="font-jp text-2xl text-primary">罪</span>
              <span className="font-heading text-2xl tracking-widest text-white">
                TSUMI
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              A dark, cinematic anime streaming experience. Metadata powered by the
              AniList API. Built for fans, by fans.
            </p>
            <p className="katakana mt-4 text-[10px]">ツミ・アニメ・ストリーミング</p>
          </div>

          <div className="grid grid-cols-2 gap-10 sm:grid-cols-3">
            <FooterCol
              title="Explore"
              jp="探索"
              links={[
                { href: '/', label: 'Home' },
                { href: '/browse', label: 'Browse' },
                { href: '/browse?sort=TRENDING_DESC', label: 'Trending' },
              ]}
            />
            <FooterCol
              title="Account"
              jp="アカウント"
              links={[
                { href: '/profile', label: 'Watchlist' },
                { href: '/profile', label: 'History' },
                { href: '/profile', label: 'Tsumi Pro' },
              ]}
            />
            <FooterCol
              title="Legal"
              jp="法的"
              links={[
                { href: '#', label: 'Terms' },
                { href: '#', label: 'Privacy' },
                { href: '#', label: 'DMCA' },
              ]}
            />
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/5 pt-6 text-xs text-zinc-600 sm:flex-row">
          <p>© {new Date().getFullYear()} Tsumi. Not affiliated with AniList.</p>
          <p className="katakana text-[9px]">罪 — つみ</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  jp,
  links,
}: {
  title: string;
  jp: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold tracking-wider text-zinc-300">
        {title}
        <span className="katakana ml-2 text-[8px]">{jp}</span>
      </h4>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-sm text-zinc-500 transition-colors hover:text-accent"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
