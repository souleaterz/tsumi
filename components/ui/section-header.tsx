import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

export function SectionHeader({
  title,
  jp,
  href,
  hrefLabel = 'View all',
}: {
  title: string;
  jp?: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mb-5 flex items-end justify-between gap-4">
      <div className="relative">
        {jp && (
          <span className="katakana absolute -top-3 left-0 text-[10px]">{jp}</span>
        )}
        <h2 className="flex items-center gap-3 text-3xl text-white sm:text-4xl">
          <span className="h-6 w-1 rounded-full bg-gradient-to-b from-primary to-accent shadow-glow" />
          {title}
        </h2>
      </div>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-sm font-medium text-zinc-400 transition-colors hover:text-accent"
        >
          {hrefLabel}
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
