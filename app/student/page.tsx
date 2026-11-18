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
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { cn, formatTZS } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import dynamic from 'next/dynamic';
// Loaded only when a buyer opens an order, to keep the first screen light.
const OrderSheet = dynamic(
  () => import('@/components/student/order-sheet').then((mod) => mod.OrderSheet),
  { ssr: false },
);
import { PushPrompt } from '@/components/student/push-prompt';
import { ErrorState } from './_components/error-state';
import { TransactionRow } from './_components/transaction-row';
import type { StudentDashboardData } from './_lib/types';

function greetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return 'home.greetMorning' as const;
  if (hour < 17) return 'home.greetAfternoon' as const;
  return 'home.greetEvening' as const;
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your meals"
        title="Ready to order?"
        description="Pick a meal, pay at checkout and collect it with your coupon."
      />
      <section className="relative overflow-hidden rounded-2xl bg-navy p-6 text-white sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
          Order · Pay · Collect
        </p>
        <h2 className="mt-3 max-w-lg text-2xl font-medium tracking-[-0.045em] sm:text-3xl">
          Today&rsquo;s meal, without the queue.
        </h2>
        <p className="mt-2 max-w-lg text-sm leading-6 text-navy-300">
          Scan the cafeteria QR to see the menu and order.
        </p>
        <Button asChild variant="gold" size="lg" className="mt-6 rounded-full px-6">
          <Link href="/student/pay">
            <ScanLine aria-hidden />
            Start an order
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
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const { t } = useT();

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<StudentDashboardData>('/api/student/dashboard'));
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'We could not load your details.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

  if (loading && !data) return <HomeSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Your meals"
          title="Ready to order?"
          description="Scan the cafeteria QR, pick a meal and pay at checkout."
        />
        <ErrorState
          message={error ?? 'We could not load your details.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const firstName = data.student.name.trim().split(/\s+/)[0] || 'there';

  const stats = [
    {
      label: t('stats.today'),
      value: formatTZS(data.stats.todaySpent),
      hint: 'Since midnight',
      icon: UtensilsCrossed,
    },
    {
      label: t('stats.week'),
      value: formatTZS(data.stats.weekSpent),
      hint: 'Weekly spend',
      icon: CalendarDays,
    },
    {
      label: t('stats.meals'),
      value: String(data.stats.mealsThisWeek),
      hint: 'Paid orders',
      icon: ChefHat,
    },
    {
      label: t('stats.coupons'),
      value: String(data.stats.couponsUsed),
      hint: 'Verified at the counter',
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${data.student.university.code} · Cafeteria ordering`}
        title={`${t(greetingKey())}, ${firstName}`}
        description={t('home.lead')}
      />

      <section
        className="relative isolate overflow-hidden rounded-2xl bg-navy p-5 text-white sm:p-7"
        aria-label="Start a meal order"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent"
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-gold">
              {t('home.heroEyebrow')}
            </p>
            <p className="mt-3 text-2xl font-medium leading-tight tracking-[-0.045em] sm:text-3xl">
              {t('home.heroTitle')}
            </p>
            <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-navy-300">{t('home.heroBody')}</p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-navy-200 sm:inline-flex">
            {data.student.university.code}
          </span>
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            variant="gold"
            size="lg"
            className="w-full rounded-full px-5 text-sm sm:w-auto sm:text-base"
          >
            <Link href="/student/pay">
              <ScanLine aria-hidden />
              {t('home.scan')}
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Link
            href="/student/history"
            className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-4 text-sm font-medium text-navy-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            {t('home.history')}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>

      <PushPrompt />

      {data.pendingOrders.length > 0 ? (
        <div className="space-y-2 animate-fade-up">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">{t('home.latestCoupon')}</p>
            <Link
              href="/student/pay"
              className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-800"
            >
              {t('home.allCoupons')}
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
          <PendingOrderCard order={data.pendingOrders[0]} openHref="/student/pay" />
          {data.pendingOrders.length > 1 ? (
            <p className="text-xs text-ink-muted">
              {data.pendingOrders.length - 1} more coupon
              {data.pendingOrders.length > 2 ? 's' : ''} waiting for the cafeteria.
            </p>
          ) : null}
        </div>
      ) : null}

      <Card className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-4">
          {stats.map((item, index) => {
            const Icon = item.icon;
            return (
              <div key={item.label} className="flex items-start gap-2.5">
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                    index === 3 ? 'bg-gold-50 text-gold-600' : 'bg-navy-50 text-navy',
                  )}
                  aria-hidden
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-0.5 truncate text-base font-medium tracking-[-0.02em] tabular text-navy">
                    {item.value}
                  </dd>
                  <dd className="text-[11px] text-ink-muted">{item.hint}</dd>
                </div>
              </div>
            );
          })}
        </dl>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title={t('home.recent')}
          description={t('home.recentLead')}
          actionLabel={t('home.allHistory')}
          actionHref="/student/history"
        />
        <div className="mt-2">
          {data.recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title={t('home.empty')}
              description={t('home.emptyLead')}
              compact
              action={
                <Button asChild size="sm">
                  <Link href="/student/pay">{t('home.orderMeal')}</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-0.5">
              {data.recentTransactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} onOpen={setOpenOrderId} />
              ))}
            </div>
          )}
        </div>
      </Card>
      <OrderSheet orderId={openOrderId} onClose={() => setOpenOrderId(null)} />
    </div>
  );
}
