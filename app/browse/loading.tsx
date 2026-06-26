import { Skeleton, CardGridSkeleton } from '@/components/ui/skeleton';

export default function BrowseLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-4 w-40" />
      {/* Filter bar placeholder */}
      <div className="glass mt-6 rounded-xl p-4">
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))}
        </div>
      </div>
      <div className="mt-8">
        <CardGridSkeleton count={18} />
      </div>
    </div>
  );
}
