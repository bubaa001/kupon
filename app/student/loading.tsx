import { Card } from '@/components/ui/card';
import { Skeleton, TransactionSkeleton } from '@/components/ui/skeleton';

export default function StudentLoading() {
  return (
    <div className="space-y-6" aria-label="Inapakia ukurasa">
      <div className="space-y-2">
        <Skeleton className="h-3 w-36" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-52 w-full rounded-[1.75rem]" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index} className="space-y-3 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <Skeleton className="h-4 w-40" />
        <div className="mt-4">
          <TransactionSkeleton />
        </div>
      </Card>
    </div>
  );
}
