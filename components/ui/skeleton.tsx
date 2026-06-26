import { cn } from '@/lib/utils';

/** Shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-surface/60',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:animate-[shimmer_1.6s_infinite] before:bg-gradient-to-r',
        'before:from-transparent before:via-white/5 before:to-transparent',
        className,
      )}
    />
  );
}

/** Poster-shaped card placeholder matching <AnimeCard>. */
export function CardSkeleton() {
  return (
    <div className="w-full">
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
    </div>
  );
}

/** A grid of card skeletons. */
export function CardGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** A horizontal row of card skeletons matching <CardRow>. */
export function CardRowSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="w-[44vw] shrink-0 sm:w-[200px]">
          <CardSkeleton />
        </div>
      ))}
    </div>
  );
}
