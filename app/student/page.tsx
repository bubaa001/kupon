'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownToLine,
  CalendarDays,
  ChefHat,
  ChevronRight,
  History,
  PlusCircle,
  Receipt,
  RotateCcw,
  ScanLine,
  UtensilsCrossed,
  Wallet,
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
import type { OrderView, StudentOrdersData } from '@/lib/orders/types';
import { ErrorState } from './_components/error-state';
import { TransactionRow } from './_components/transaction-row';
import type { WalletData } from './_lib/types';

const QUICK_ACTIONS = [
  {
    href: '/student/topup',
    label: 'Weka pesa',
    icon: PlusCircle,
    tone: 'bg-emerald-50 text-emerald-600',
  },
  { href: '/student/pay', label: 'Scan', icon: ScanLine, tone: 'bg-sky-50 text-sky-600' },
  { href: '/student/history', label: 'Historia', icon: History, tone: 'bg-violet-50 text-violet-600' },
  {
    href: '/student/refunds',
    label: 'Refund',
    icon: RotateCcw,
    tone: 'bg-amber-50 text-amber-600',
  },
] as const;

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Habari za asubuhi';
  if (hour < 17) return 'Habari za mchana';
  return 'Habari za jioni';
}

function HomeSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-[196px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[104px] rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[76px] rounded-xl" />
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
  const [data, setData] = useState<WalletData | null>(null);
  const [pendingOrders, setPendingOrders] = useState<OrderView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [walletData, ordersData] = await Promise.all([
        apiFetch<WalletData>('/api/student/wallet'),
        apiFetch<StudentOrdersData>('/api/student/orders?status=PENDING').catch(() => null),
      ]);
      setData(walletData);
      setPendingOrders(
        (ordersData?.orders ?? []).filter((entry) => entry.status === 'PENDING'),
      );
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : 'Imeshindikana kupakia wallet yako.',
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
          eyebrow="Wallet"
          title="Salio lako"
          description="Angalia salio, matumizi na shughuli zako za hivi karibuni."
        />
        <ErrorState message={error ?? 'Imeshindikana kupakia wallet yako.'} onRetry={() => void load()} />
      </div>
    );
  }

  const firstName = data.student.name.trim().split(/\s+/)[0] ?? 'Mwanafunzi';

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${data.student.university.code} • Student wallet`}
        title={`${greeting()}, ${firstName}`}
        description="Hii ni salio lako, matumizi ya leo na shughuli za hivi karibuni."
        actions={
          <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
            <Link href="/student/topup">
              <PlusCircle aria-hidden />
              Weka pesa
            </Link>
          </Button>
        }
      />

      {/* Balance hero */}
      <section className="balance-card animate-fade-up p-5 sm:p-6" aria-label="Salio la wallet">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Salio lako
            </p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-tight tabular sm:text-[2.4rem]">
              {formatTZS(data.balance)}
            </p>
            <p className="mt-2.5 truncate text-xs text-emerald-100/70">
              {data.student.studentId} • {data.student.university.name}
            </p>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold tracking-wide text-emerald-100">
            {data.student.university.code}
          </span>
        </div>

        <div className="relative z-10 mt-6 grid grid-cols-2 gap-2.5">
          <Button
            asChild
            size="lg"
            className="w-full bg-white px-3 text-sm text-primary-800 hover:bg-emerald-50 sm:px-6 sm:text-base"
          >
            <Link href="/student/topup">
              <PlusCircle aria-hidden />
              Weka pesa
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="secondary"
            className="w-full border border-white/20 bg-white/10 px-3 text-sm text-white shadow-none hover:bg-white/20 sm:px-6 sm:text-base"
          >
            <Link href="/student/pay">
              <ScanLine aria-hidden />
              Scan &amp; order
            </Link>
          </Button>
        </div>
      </section>

      {pendingOrders.length > 0 ? (
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
          <PendingOrderCard order={pendingOrders[0]} openHref="/student/pay" />
          {pendingOrders.length > 1 ? (
            <p className="text-[11px] text-slate-500">
              +{pendingOrders.length - 1} coupon{pendingOrders.length > 2 ? 's' : ''} nyingine
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
              label: 'Top-ups',
              value: String(data.stats.totalTopUps),
              hint: 'Zilizofanikiwa',
              icon: ArrowDownToLine,
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

      {/* Quick actions */}
      <nav className="grid grid-cols-4 gap-2" aria-label="Quick actions">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-1 py-3 text-center shadow-card transition-colors hover:border-primary-200 hover:bg-primary-50/40"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${action.tone}`}
                aria-hidden
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[11px] font-semibold text-slate-600">{action.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Recent activity */}
      <Card className="p-5">
        <SectionHeading
          title="Shughuli za hivi karibuni"
          description="Miamala ya mwisho kwenye wallet yako"
          actionLabel="Ona zote"
          actionHref="/student/history"
        />
        <div className="mt-2">
          {data.recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Hakuna shughuli bado"
              description="Weka pesa kwenye wallet yako kisha lipa chakula kwa kuchagua. Miamala yako itaonekana hapa."
              compact
              action={
                <Button asChild size="sm">
                  <Link href="/student/topup">Weka pesa kwa mara ya kwanza</Link>
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
