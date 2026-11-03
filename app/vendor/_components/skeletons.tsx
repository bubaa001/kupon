import { Skeleton } from '@/components/ui/skeleton';

/** Shimmer placeholders shared by the vendor screens while data loads. */

export function StatCardsSkeleton({ count = 2, className = '' }: { count?: number; className?: string }) {
  return (
    <div className={className || `grid gap-3 sm:grid-cols-2`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-surface space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function SaleListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardBlockSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="card-surface p-5">
      <Skeleton className="h-4 w-28" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-1/3" />
            </div>
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
