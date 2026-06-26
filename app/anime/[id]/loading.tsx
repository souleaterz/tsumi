import { Skeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function AnimeDetailLoading() {
  return (
    <div className="relative">
      {/* Banner */}
      <Skeleton className="h-[42vh] min-h-[300px] w-full rounded-none" />

      <div className="mx-auto -mt-40 max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-8 lg:flex-row">
          {/* Poster */}
          <div className="z-10 mx-auto w-48 shrink-0 sm:w-60 lg:mx-0">
            <Skeleton className="aspect-[2/3] w-full rounded-xl" />
            <Skeleton className="mt-4 h-12 w-full rounded-md" />
            <Skeleton className="mt-3 h-12 w-full rounded-md" />
          </div>

          {/* Info */}
          <div className="z-10 flex-1 pt-2 lg:pt-40">
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="mt-3 h-5 w-1/3" />
            <div className="mt-5 flex gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="mt-6 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        </div>

        {/* Episodes */}
        <div className="mt-14">
          <Skeleton className="mb-5 h-8 w-40" />
          <CardGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
}
