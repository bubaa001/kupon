'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ChevronRight,
  ClipboardCheck,
  LifeBuoy,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { VendorQrCard } from '@/components/orders/vendor-qr-card';
import { cn, formatDate, formatTZS } from '@/lib/utils';
import { useApiData } from '../_lib/use-api';
import type { VendorStats } from '../_lib/types';
import { SaleList } from './sale-list';
import { TopItemsList } from './top-items-list';
import { LoadError } from './feedback';
import { CardBlockSkeleton, SaleListSkeleton } from './skeletons';

/**
 * The owner's overview: how today is going, what needs attention, and where
 * the money is. Built to be read in one glance on a phone.
 */
export function VendorHome() {
  const { data, loading, error, reload } = useApiData<VendorStats>('/api/vendor/stats');
  const [todayLabel, setTodayLabel] = useState('');

  // Rendered after mount so the server HTML and client HTML always match.
  useEffect(() => {
    setTodayLabel(formatDate(new Date(), 'EEEE, dd MMMM'));
  }, []);

  return (
    <div className="space-y-5">
      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <>
          <Skeleton className="h-[188px] w-full rounded-2xl" />
          <div className="grid grid-cols-3 gap-2.5">
            <Skeleton className="h-[96px] rounded-2xl" />
            <Skeleton className="h-[96px] rounded-2xl" />
            <Skeleton className="h-[96px] rounded-2xl" />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <CardBlockSkeleton rows={4} />
            <div className="card-surface p-5">
              <Skeleton className="h-4 w-28" />
              <div className="mt-5">
                <SaleListSkeleton rows={4} />
              </div>
            </div>
          </div>
        </>
      ) : null}

      {data ? (
        <>
          <section
            className="relative overflow-hidden rounded-2xl bg-navy p-5 text-white animate-fade-up sm:p-6"
            aria-label="Today"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
            />
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              {todayLabel || 'Today'} · {data.vendor.name}
            </p>
            <p className="mt-3 text-[2.25rem] font-medium leading-none tracking-[-0.05em] tabular sm:text-5xl">
              {formatTZS(data.todaySales)}
            </p>
            <p className="mt-2 text-sm text-navy-300">
              {data.transactionCount > 0
                ? `${data.transactionCount} ${data.transactionCount === 1 ? 'sale' : 'sales'} today · average ${formatTZS(data.averageSale)}`
                : 'No sales yet today'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="gold" size="sm">
                <Link href="/vendor/sales">See sales</Link>
              </Button>
              <Button
                asChild
                size="sm"
                variant="ghost"
                className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/vendor/settlement">Money</Link>
              </Button>
            </div>
          </section>

          <section aria-label="Needs attention" className="space-y-2">
            <p className="eyebrow">Needs attention</p>
            <div className="grid grid-cols-3 gap-2.5">
              <AttentionTile
                href="/vendor/scan"
                icon={ClipboardCheck}
                value={data.attention.ordersWaiting + data.attention.couponsReady}
                label="Orders open"
                hint={
                  data.attention.ordersWaiting > 0
                    ? `${data.attention.ordersWaiting} to accept`
                    : `${data.attention.couponsReady} to collect`
                }
                urgent={data.attention.ordersWaiting > 0}
              />
              <AttentionTile
                href="/vendor/credit-requests"
                icon={LifeBuoy}
                value={data.attention.openCases}
                label="Meal cases"
                hint={data.attention.openCases > 0 ? 'Finance to decide' : 'None open'}
                urgent={data.attention.openCases > 0}
              />
              <AttentionTile
                href="/vendor/settlement"
                icon={Wallet}
                value={formatTZS(data.pendingBalance)}
                label="Balance"
                hint="Ready to withdraw"
              />
            </div>
          </section>

          <div className="grid min-w-0 gap-4 lg:grid-cols-2">
            <section className="card-surface min-w-0 overflow-hidden p-5">
              <SectionHeading
                title="Top sellers today"
                description={data.topItems.length > 0 ? 'Ranked by revenue' : 'No dishes sold yet'}
                actionLabel={data.topItems.length > 0 ? 'All sales' : undefined}
                actionHref={data.topItems.length > 0 ? '/vendor/sales' : undefined}
              />
              <div className="mt-4 min-w-0">
                <TopItemsList
                  items={data.topItems}
                  emptyState={
                    <EmptyState
                      icon={UtensilsCrossed}
                      title="Nothing sold yet today"
                      description="Your best sellers appear here after the first paid order."
                      compact
                    />
                  }
                />
              </div>
            </section>

            <section className="card-surface min-w-0 overflow-hidden p-5">
              <SectionHeading
                title="Latest sales"
                description="Newest first"
                actionLabel={data.recentSales.length > 0 ? 'View all' : undefined}
                actionHref={data.recentSales.length > 0 ? '/vendor/sales' : undefined}
              />
              <div className="mt-3 min-w-0">
                <SaleList
                  sales={data.recentSales.slice(0, 5)}
                  emptyState={
                    <EmptyState
                      icon={ClipboardCheck}
                      title="No sales yet"
                      description="Buyers scan your counter QR to order. Paid orders appear here."
                      compact
                    />
                  }
                />
              </div>
            </section>
          </div>

          <section id="counter-qr" className="scroll-mt-24 space-y-2" aria-label="Counter QR">
            <p className="eyebrow">Counter QR</p>
            <VendorQrCard />
          </section>
        </>
      ) : null}
    </div>
  );
}

function AttentionTile({
  href,
  icon: Icon,
  value,
  label,
  hint,
  urgent = false,
}: {
  href: string;
  icon: LucideIcon;
  value: number | string;
  label: string;
  hint: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'group flex min-h-[104px] min-w-0 flex-col justify-between rounded-2xl border bg-white p-3 transition-colors hover:bg-navy-50',
        urgent ? 'border-gold' : 'border-navy/[0.09]',
      )}
    >
      <span className="flex items-center justify-between">
        <Icon className={cn('h-4 w-4', urgent ? 'text-gold-600' : 'text-ink-muted')} aria-hidden />
        <ChevronRight className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-lg font-semibold leading-tight tracking-[-0.03em] text-navy tabular">
          {value}
        </span>
        <span className="block text-xs font-medium text-navy">{label}</span>
        <span className="block truncate text-[11px] text-ink-muted">{hint}</span>
      </span>
    </Link>
  );
}
