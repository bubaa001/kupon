'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/client-api';
import type { WalletData } from '../_lib/types';

/**
 * The server layout passes a balance snapshot into `StudentShell`. This tiny
 * background poller refreshes the server components (shell included) whenever
 * the wallet balance changes — for example when a pending top-up settles while
 * the student is still reading the home screen.
 *
 * It renders nothing and stays silent on transient network errors; explicit
 * actions (top-up, payment, refund) also call `router.refresh()` directly.
 */
export function LiveBalance({ initialBalance }: { initialBalance: number }) {
  const router = useRouter();
  const knownBalance = useRef(initialBalance);

  useEffect(() => {
    knownBalance.current = initialBalance;
  }, [initialBalance]);

  useEffect(() => {
    let cancelled = false;

    const sync = async () => {
      try {
        const data = await apiFetch<WalletData>('/api/student/wallet');
        if (cancelled || data.balance === knownBalance.current) return;
        knownBalance.current = data.balance;
        router.refresh();
      } catch {
        // Background sync is best-effort: the pages surface real errors.
      }
    };

    const interval = setInterval(() => {
      void sync();
    }, 20_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [router]);

  return null;
}
