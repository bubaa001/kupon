import { PageSkeleton } from '@/components/ui/skeleton';

/** Route-level fallback while the next student page segment streams in. */
export default function StudentLoading() {
  return <PageSkeleton />;
}
