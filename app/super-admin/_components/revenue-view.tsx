'use client';

import Link from 'next/link';
import {
  CreditCard,
  Percent,
  RefreshCw,
  Scale,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn, formatCompactTZS, formatNumber, formatTZS } from '@/lib/utils';
import { RevenueMixChart } from './revenue-mix-chart';
import { UniversityStatusBadge } from './badges';
import type { MonthPoint, RevenueData, TenantRevenue } from './types';
import { useApiData } from './use-api-data';

export function RevenueView() {
  const { data, error, loading, refreshing, reload } = useApiData<RevenueData>(
    '/api/super-admin/revenue',
  );

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bubaa Comp · Revenue"
          title="Platform revenue"
          description="Fee waterfall, SaaS billing, rail costs and the live ledger check."
        />
        <Alert variant="danger" title="Could not load platform revenue">
          {error ?? 'The platform API returned no data.'}{' '}
          <button
            type="button"
            onClick={() => void reload()}
            className="font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  const { totals, ledger } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bubaa Comp · Revenue"
        title="Platform revenue"
        description="All-time fee waterfall, SaaS billing, mobile-money rail costs and the live double-entry ledger check."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload({ silent: true })}
              loading={refreshing}
            >
              {refreshing ? null : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/super-admin/health">
                <Scale className="h-4 w-4" />
                Ledger health
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Gross volume"
          value={formatTZS(data.grossVolume)}
          icon={Wallet}
          accent="emerald"
          hint={`${formatNumber(totals.transactionCount)} settled payments`}
        />
        <StatCard
          label="Platform fee revenue"
          value={formatTZS(data.transactionFees)}
          icon={Percent}
          accent="sky"
          hint={`before ${formatTZS(data.universityRevenue)} share`}
        />
        <StatCard
          label="SaaS revenue billed"
          value={formatTZS(data.saasRevenue)}
          icon={CreditCard}
          accent="violet"
          hint={`${formatCompactTZS(totals.saasOutstanding)} outstanding`}
        />
        <StatCard
          label="Platform net revenue"
          value={formatTZS(data.platformNet)}
          icon={TrendingUp}
          accent="navy"
          hint="fees + SaaS − university share − rail"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Revenue mix · last 6 months</p>
              <p className="mt-1 text-xs text-slate-500">
                Bars show platform fees and collected SaaS · the line tracks merchant GMV.
              </p>
            </div>
            <Badge variant="outline">All tenants</Badge>
          </div>
          <div className="mt-4">
            <RevenueMixChart data={data.series} height={300} />
          </div>
        </div>

        <div className="card-surface p-5">
          <p className="eyebrow">Unit economics</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            Fee model: {data.feeModel.platformFeePercent}% platform fee ·{' '}
            {data.feeModel.aggregatorFeePercent}% mobile-money rail ·{' '}
            {data.feeModel.universitySharePercent}% of the fee to the university
          </p>
          <div className="mt-4 space-y-2.5">
            <BreakdownRow label="Gross merchant volume" value={formatTZS(data.grossVolume)} />
            <BreakdownRow
              label="Platform fee collected"
              value={`+ ${formatTZS(data.transactionFees)}`}
              tone="positive"
            />
            <BreakdownRow
              label="University revenue share"
              value={`− ${formatTZS(data.universityRevenue)}`}
              tone="negative"
            />
            <BreakdownRow
              label="Wallet top-up volume"
              value={formatTZS(totals.topupVolume)}
              tone="neutral"
            />
            <BreakdownRow
              label="Mobile-money rail costs"
              value={`− ${formatTZS(data.aggregatorCosts)}`}
              tone="negative"
            />
            <div className="mt-1 border-t border-slate-200 pt-2.5">
              <BreakdownRow
                label="Transaction-fee net"
                value={formatTZS(totals.platformTransactionNet)}
                strong
                tone={totals.platformTransactionNet < 0 ? 'negative' : 'positive'}
              />
            </div>
            <BreakdownRow
              label="SaaS collected"
              value={`+ ${formatTZS(totals.saasCollected)}`}
              tone="positive"
            />
          </div>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Platform net revenue
            </p>
            <p className="mt-1 text-xl font-semibold tracking-tight text-slate-900 tabular">
              {formatTZS(data.platformNet)}
            </p>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Each settled sale pays the university its share of the platform fee plus the
            mobile-money rail cost; the remainder is Kupon transaction net. SaaS subscriptions are
            billed separately every month and are the platform's largest revenue line.
          </p>
        </div>
      </div>

      {totals.platformTransactionNet < 0 ? (
        <Alert variant="warning" title="Transaction-fee margin is negative this period">
          The platform absorbed {formatTZS(Math.abs(totals.platformTransactionNet))} more in
          university revenue share and mobile-money rail costs than it collected in transaction
          fees. SaaS subscriptions ({formatTZS(totals.saasCollected)} collected) keep the platform
          cash-positive.
        </Alert>
      ) : null}

      <Tabs defaultValue="per-tenant">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Revenue by tenant
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              All-time, derived from the transaction ledger and SaaS invoices
            </p>
          </div>
          <TabsList>
            <TabsTrigger value="per-tenant">Per tenant</TabsTrigger>
            <TabsTrigger value="monthly">Monthly ledger</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="per-tenant">
          {data.perTenant.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="No tenant revenue yet"
              description="University revenue appears here after the first settled campus payment."
            />
          ) : (
            <>
              <div className="card-surface hidden overflow-hidden xl:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">GMV</TableHead>
                      <TableHead className="text-right">Fees</TableHead>
                      <TableHead className="text-right">University share</TableHead>
                      <TableHead className="text-right">Rail costs</TableHead>
                      <TableHead className="text-right">Txn net</TableHead>
                      <TableHead className="text-right">SaaS collected</TableHead>
                      <TableHead className="text-right">Platform net</TableHead>
                      <TableHead className="w-[140px]">Share of GMV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.perTenant.map((tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <p className="text-sm font-semibold text-slate-900">{tenant.name}</p>
                          <p className="text-[11px] text-slate-500">
                            {tenant.code} · {formatNumber(tenant.transactions)} payments
                          </p>
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm">
                          {formatTZS(tenant.gmv)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm">
                          {formatTZS(tenant.platformFee)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm text-slate-500">
                          {formatTZS(tenant.universityRevenue)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm text-slate-500">
                          {formatTZS(tenant.aggregatorFee)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right whitespace-nowrap tabular text-sm font-semibold',
                            tenant.transactionNet < 0 ? 'text-red-600' : 'text-emerald-700',
                          )}
                        >
                          {formatTZS(tenant.transactionNet)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm">
                          {formatTZS(tenant.saasCollected)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap tabular text-sm font-semibold text-slate-900">
                          {formatTZS(tenant.platformNet)}
                        </TableCell>
                        <TableCell>
                          <Progress
                            value={
                              data.grossVolume > 0
                                ? Math.min(100, (tenant.gmv / data.grossVolume) * 100)
                                : 0
                            }
                            indicatorClassName="bg-primary-500"
                            className="h-1.5"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">
                            {data.grossVolume > 0
                              ? `${Math.round((tenant.gmv / data.grossVolume) * 100)}% of volume`
                              : 'No volume yet'}
                          </p>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:hidden">
                {data.perTenant.map((tenant) => (
                  <TenantRevenueCard key={tenant.id} tenant={tenant} grossVolume={data.grossVolume} />
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="monthly">
          <div className="card-surface overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">GMV</TableHead>
                  <TableHead className="text-right">Platform fees</TableHead>
                  <TableHead className="text-right">SaaS collected</TableHead>
                  <TableHead className="text-right">Rail costs</TableHead>
                  <TableHead className="text-right">Platform net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.series.map((month) => (
                  <MonthlyRow key={month.period} month={month} />
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            SaaS is recognised on the invoice issue date. Platform net = platform fees − university
            share − rail costs + collected SaaS for the month.
          </p>
        </TabsContent>
      </Tabs>

      <div className="card-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Scale className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">Double-entry ledger</p>
              <p className="text-xs text-slate-500">
                Every transaction posts balanced debits and credits.
              </p>
            </div>
          </div>
          <Badge variant={ledger.balanced ? 'success' : 'danger'} dot>
            {ledger.balanced ? 'Balanced' : 'Out of balance'}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <LedgerStat label="Total debits" value={formatTZS(ledger.debits)} />
          <LedgerStat label="Total credits" value={formatTZS(ledger.credits)} />
          <LedgerStat
            label="Difference"
            value={formatTZS(ledger.difference)}
            tone={ledger.difference === 0 ? 'ok' : 'bad'}
          />
          <LedgerStat label="Journal entries" value={formatNumber(ledger.entries)} />
        </div>

        <Alert
          variant={ledger.balanced ? 'success' : 'danger'}
          className="mt-4"
          title={ledger.balanced ? 'Ledger invariant holds' : 'Ledger imbalance detected'}
        >
          {ledger.balanced
            ? `SUM(debit) = SUM(credit) = ${formatTZS(ledger.debits)} across ${formatNumber(
                ledger.entries,
              )} journal entries.`
            : `Debits and credits differ by ${formatTZS(
                Math.abs(ledger.difference),
              )}. Freeze financial writes and investigate the affected transactions.`}
        </Alert>

        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/super-admin/health">
            <Scale className="h-4 w-4" />
            Open system health
          </Link>
        </Button>
      </div>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  tone = 'neutral',
  strong = false,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'positive' | 'negative';
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500">{label}</span>
      <span
        className={cn(
          'tabular text-sm',
          strong ? 'font-semibold' : 'font-medium',
          tone === 'positive' && 'text-emerald-700',
          tone === 'negative' && 'text-red-600',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function LedgerStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'bad';
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 tabular text-sm font-semibold',
          tone === 'ok' && 'text-emerald-700',
          tone === 'bad' && 'text-red-600',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TenantRevenueCard({
  tenant,
  grossVolume,
}: {
  tenant: TenantRevenue;
  grossVolume: number;
}) {
  const share = grossVolume > 0 ? Math.round((tenant.gmv / grossVolume) * 100) : 0;

  return (
    <div className="card-surface min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900" title={tenant.name}>
            {tenant.name}
          </p>
          <p className="text-[11px] text-slate-500">
            {tenant.code} · {formatNumber(tenant.transactions)} payments
          </p>
        </div>
        <UniversityStatusBadge status={tenant.status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">GMV</dt>
          <dd className="tabular text-sm font-semibold text-slate-900">{formatTZS(tenant.gmv)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform fees
          </dt>
          <dd className="tabular text-sm text-slate-700">{formatTZS(tenant.platformFee)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            SaaS collected
          </dt>
          <dd className="tabular text-sm text-slate-700">{formatTZS(tenant.saasCollected)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Rail costs
          </dt>
          <dd className="tabular text-sm text-slate-700">{formatTZS(tenant.aggregatorFee)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Platform net
          </dt>
          <dd
            className={cn(
              'tabular text-sm font-semibold',
              tenant.platformNet < 0 ? 'text-red-600' : 'text-emerald-700',
            )}
          >
            {formatTZS(tenant.platformNet)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Share of GMV
          </dt>
          <dd className="text-sm font-semibold text-slate-900 tabular">{share}%</dd>
        </div>
      </dl>

      <div className="mt-3">
        <Progress value={Math.min(100, share)} className="h-1.5" />
      </div>
    </div>
  );
}

function MonthlyRow({ month }: { month: MonthPoint }) {
  return (
    <TableRow>
      <TableCell>
        <p className="text-sm font-semibold text-slate-900">{month.label}</p>
        <p className="text-[11px] text-slate-400 tabular">{month.period}</p>
      </TableCell>
      <TableCell className="text-right tabular text-sm">{formatTZS(month.gmv)}</TableCell>
      <TableCell className="text-right tabular text-sm">{formatTZS(month.platformFee)}</TableCell>
      <TableCell className="text-right tabular text-sm">{formatTZS(month.saasCollected)}</TableCell>
      <TableCell className="text-right tabular text-sm text-slate-500">
        {formatTZS(month.aggregatorFee)}
      </TableCell>
      <TableCell
        className={cn(
          'text-right tabular text-sm font-semibold',
          month.platformNet < 0 ? 'text-red-600' : 'text-slate-900',
        )}
      >
        {formatTZS(month.platformNet)}
      </TableCell>
    </TableRow>
  );
}
