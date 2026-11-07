'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Banknote,
  ClipboardCheck,
  QrCode,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { EmptyState } from '@/components/ui/empty-state';
import { VendorQrCard } from '@/components/orders/vendor-qr-card';
import { formatDate, formatTZS } from '@/lib/utils';
import { useApiData } from '../_lib/use-api';
import type { VendorStats } from '../_lib/types';
import { SaleList } from './sale-list';
import { TopItemsList } from './top-items-list';
import { LoadError } from './feedback';
import { CardBlockSkeleton, SaleListSkeleton } from './skeletons';

const QUICK_ACTIONS = [
  {
    href: '/vendor/scan',
    label: 'Order desk',
    hint: 'Verify coupons',
    icon: ClipboardCheck,
  },
  {
    href: '/vendor/sales',
    label: 'Sales report',
    hint: 'Today, week, month',
    icon: TrendingUp,
  },
  {
    href: '/vendor/menu',
    label: 'Update menu',
    hint: 'Prices & photos',
    icon: UtensilsCrossed,
  },
  {
    href: '#counter-qr',
    label: 'Show menu QR',
    hint: 'Student scan point',
    icon: QrCode,
  },
];

export function VendorHome() {
  const { data, loading, error, reload } = useApiData<VendorStats>('/api/vendor/stats');
  const [todayLabel, setTodayLabel] = useState('');

  // Rendered after mount so the server HTML and client HTML always match.
  useEffect(() => {
    setTodayLabel(formatDate(new Date(), 'EEEE, dd MMMM'));
  }, []);

  const showInitialSkeleton = loading && !data;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={todayLabel || 'Vendor terminal'}
        title="Today's till"
        description={
          data
            ? `Live sales at ${data.vendor.name} • ${data.vendor.university.name}`
            : 'Live sales, top sellers and your settlement balance.'
        }
      />

      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {showInitialSkeleton ? (
        <>
          <Skeleton className="h-[236px] w-full rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-[116px] w-full rounded-xl" />
            <Skeleton className="h-[116px] w-full rounded-xl" />
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
          <section className="balance-card animate-fade-up p-5 sm:p-6" aria-label="Today's sales">
            <div className="relative z-10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                  Today&apos;s sales
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Till online
                </span>
              </div>
              <p className="tabular mt-3 text-[2rem] font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                {formatTZS(data.todaySales)}
              </p>
              <p className="mt-1.5 text-xs text-emerald-100/75">
                {data.transactionCount} {data.transactionCount === 1 ? 'payment' : 'payments'} today
                {' • '}
                {data.transactionCount > 0
                  ? `avg ${formatTZS(data.averageSale)}`
                  : 'waiting for the first student order'}
              </p>

              <div className="mt-5 flex flex-wrap gap-2">
                <Button
                  asChild
                  size="sm"
                  className="bg-white text-emerald-800 shadow-none hover:bg-emerald-50"
                >
                  <Link href="/vendor/scan">
                    <ClipboardCheck />
                    Open order desk
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="ghost"
                  className="border border-white/15 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/vendor/sales">View sales</Link>
                </Button>
              </div>
            </div>
          </section>

          <section id="counter-qr" className="scroll-mt-24" aria-label="Counter menu QR">
            <VendorQrCard />
          </section>

          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <StatCard
              label="Pending settlement"
              value={formatTZS(data.pendingBalance)}
              icon={Wallet}
              accent="amber"
              hint="Request a payout from the settlement screen"
            />
            <StatCard
              label="Total settled"
              value={formatTZS(data.totalSettled)}
              icon={Banknote}
              accent="emerald"
              hint="Lifetime payouts to your account"
            />
          </div>

          <section aria-label="Quick actions" className="grid min-w-0 grid-cols-2 gap-2.5 sm:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="card-surface group flex min-h-[88px] min-w-0 flex-col justify-between overflow-hidden p-3 transition-colors hover:border-emerald-200 hover:bg-emerald-50/40"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 transition-transform group-hover:scale-105">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-[11px] font-semibold leading-tight text-slate-800">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-tight text-slate-500">
                      {action.hint}
                    </span>
                  </span>
                </Link>
              );
            })}
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
                      title="The kitchen is warming up"
                      description="Capture your first payment of the day and your best sellers will appear here."
                      compact
                    />
                  }
                />
              </div>
            </section>

            <section className="card-surface min-w-0 overflow-hidden p-5">
              <SectionHeading
                title="Recent sales"
                description="Latest order payments"
                actionLabel={data.recentSales.length > 0 ? 'View all' : undefined}
                actionHref={data.recentSales.length > 0 ? '/vendor/sales' : undefined}
              />
              <div className="mt-3 min-w-0">
                <SaleList
                  sales={data.recentSales.slice(0, 5)}
                  emptyState={
                    <EmptyState
                      icon={ClipboardCheck}
                      title="No orders yet"
                      description="Students scan your counter QR to place an order. It appears here after its Kupon test payment is confirmed."
                      compact
                      action={
                        <Button asChild size="sm">
                          <Link href="/vendor/scan">
                            <ClipboardCheck />
                            Open order desk
                          </Link>
                        </Button>
                      }
                    />
                  }
                />
              </div>
            </section>
          </div>

          {data.pendingBalance > 0 ? (
            <section className="flex min-w-0 flex-col gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100">
                  <Wallet className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-emerald-950">
                    {formatTZS(data.pendingBalance)} ready to settle
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-emerald-800/80">
                    Sales stay in your pending balance until you request a payout. Move them to your
                    settlement account in one tap.
                  </p>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0">
                <Link href="/vendor/settlement">Open settlement</Link>
              </Button>
            </section>
          ) : (
            <div className="card-surface flex min-w-0 items-center gap-3 overflow-hidden p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <Banknote className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">All caught up</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  No pending balance. Every settled sale has been paid out to your account.
                </p>
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
