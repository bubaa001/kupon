'use client';

import { useRouter } from 'next/navigation';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

/** Re-checks the approval status every 15 seconds; approval moves the owner on. */
export function PendingAutoRefresh() {
  const router = useRouter();
  useAutoRefresh(() => router.refresh());
  return null;
}
