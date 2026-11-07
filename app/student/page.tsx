'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  ChefHat,
  ChevronRight,
  Receipt,
  ScanLine,
  UtensilsCrossed,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SectionHeading } from '@/components/ui/section-heading';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton, TransactionSkeleton } from '@/components/ui/skeleton';
import { PendingOrderCard } from '@/components/student/pending-order-card';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { cn, formatTZS } from '@/lib/utils';
import type { OrderView } from '@/lib/orders/types';
import { ErrorState } from './_components/error-state';
import { TransactionRow } from './_components/transaction-row';
import type { StudentDashboardData } from './_lib/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Habari za asubuhi';
  if (hour < 17) return 'Habari za mchana';
  return 'Habari za jioni';
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Kupon • Mlo wako"
        title="Tayari kuagiza?"
        description="Chagua chakula, lipa kwa mobile money na uchukue coupon yako."
      />
      <section className="relative overflow-hidden rounded-[1.75rem] bg-navy p-6 text-white sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-200">
          Agiza • Lipa • Pata coupon
        </p>
        <h2 className="mt-3 max-w-lg text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
          Chakula cha leo, bila kusubiri.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-300">
          Scan QR ya cafeteria ili kuona menu na kuagiza.
        </p>
        <Button asChild size="lg" className="mt-6 rounded-full bg-white px-6 text-primary-900 hover:bg-primary-50">
          <Link href="/student/pay">
            <ScanLine aria-hidden />
            Anza kuagiza
          </Link>
        </Button>
      </section>
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

export default function StudentHomePage() {
  const [data, setData] = useState<StudentDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<StudentDashboardData>('/api/student/dashboard'));
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Imeshindikana kupakia taarifa zako.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <HomeSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Kupon • Mlo wako"
          title="Tayari kuagiza?"
          description="Changanua QR ya cafeteria, chagua chakula na ulipe kwa mobile money."
        />
        <ErrorState message={error ?? 'Imeshindikana kupakia taarifa zako.'} onRetry={() => void load()} />
      </div>
    );
  }

  const firstName = data.student.name.trim().split(/\s+/)[0] ?? 'Mwanafunzi';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${data.student.university.code} • Cafeteria ordering`}
        title={`${greeting()}, ${firstName}`}
        description="Chagua chakula, lipa moja kwa moja kwa mobile money na uchukue coupon baada ya uthibitisho."
        actions={
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/student/pay">
              <ScanLine aria-hidden />
              Anza kuagiza
            </Link>
          </Button>
        }
      />

      <section
        className="relative isolate overflow-hidden rounded-[1.75rem] bg-navy p-5 text-white shadow-lift sm:p-7"
        aria-label="Anza kuagiza chakula"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-20 -z-10 h-64 w-64 rounded-full border border-white/10"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -right-5 -top-16 -z-10 h-52 w-52 rounded-full border border-white/10"
        />
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-200">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-300" aria-hidden />
              Agiza • Lipa • Pata coupon
            </p>
            <p className="mt-3 text-2xl font-semibold leading-tight tracking-[-0.04em] sm:text-3xl">
              Chakula kizuri, oda iliyo wazi.
            </p>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-slate-300">
              Scan QR ya cafeteria, chagua kinachopatikana leo na ulipe kwa mobile money. Coupon
              yako itatokea baada ya malipo kuthibitishwa.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-primary-100 sm:inline-flex">
            {data.student.university.code}
          </span>
        </div>

        <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="w-full rounded-full bg-white px-5 text-sm text-primary-900 hover:bg-primary-50 sm:w-auto sm:text-base"
          >
            <Link href="/student/pay">
              <ScanLine aria-hidden />
              Scan cafeteria QR
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Link
            href="/student/history"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            Historia ya oda
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      {data.pendingOrders.length > 0 ? (
        <div className="space-y-2 animate-fade-up">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
              Coupon yako ya hivi karibuni
            </p>
            <Link
              href="/student/pay"
              className="inline-flex min-h-[32px] items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800"
            >
              Coupons zote
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <PendingOrderCard order={data.pendingOrders[0]} openHref="/student/pay" />
          {data.pendingOrders.length > 1 ? (
            <p className="text-[11px] text-slate-500">
              +{data.pendingOrders.length - 1} coupon{data.pendingOrders.length > 2 ? 's' : ''} nyingine
              zinanasubiri vendor.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Stats */}
      <Card className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          {[
            {
              label: 'Matumizi leo',
              value: formatTZS(data.stats.todaySpent),
              hint: 'Tangu asubuhi',
              icon: UtensilsCrossed,
              tone: 'bg-rose-50 text-rose-600',
            },
            {
              label: 'Siku 7',
              value: formatTZS(data.stats.weekSpent),
              hint: 'Matumizi ya wiki',
              icon: CalendarDays,
              tone: 'bg-amber-50 text-amber-600',
            },
            {
              label: 'Milo wiki',
              value: String(data.stats.mealsThisWeek),
              hint: 'Zilizolipwa',
              icon: ChefHat,
              tone: 'bg-sky-50 text-sky-600',
            },
            {
              label: 'Coupons zimetumika',
              value: String(data.stats.couponsUsed),
              hint: 'Zilizokaguliwa',
              icon: Receipt,
              tone: 'bg-emerald-50 text-emerald-600',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    item.tone,
                  )}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-sm font-semibold tabular text-slate-900">
                    {item.value}
                  </dd>
                  <dd className="text-[10px] text-slate-400">{item.hint}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </Card>

      {/* Recent activity */}
      <Card className="p-5">
        <SectionHeading
          title="Oda na malipo ya hivi karibuni"
          description="Historia yako ya ununuzi wa chakula"
          actionLabel="Historia yote"
          actionHref="/student/history"
        />
        <div className="mt-2">
          {data.recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Hakuna shughuli bado"
              description="Baada ya kulipia oda kwa mobile money, malipo na hali ya coupon yako vitaonekana hapa."
              compact
              action={
                <Button asChild size="sm">
                  <Link href="/student/pay">Agiza chakula</Link>
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.recentTransactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
