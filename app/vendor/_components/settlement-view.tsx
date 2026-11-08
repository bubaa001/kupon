'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Landmark,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeading } from '@/components/ui/section-heading';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { postJson } from '@/lib/client-api';
import { cn, formatDate, formatTZS } from '@/lib/utils';
import { toast } from 'sonner';
import { useApiData } from '../_lib/use-api';
import type { SettlementResponse, SettlementResult } from '../_lib/types';
import { SaleList } from './sale-list';
import { LoadError } from './feedback';
import { CardBlockSkeleton } from './skeletons';

function PayoutStatusBadge({ status }: { status: string }) {
  if (status === 'SIMULATED' || status === 'PAID') return <Badge variant="success" dot>Test record</Badge>;
  if (status === 'PENDING') return <Badge variant="warning" dot>Not processed</Badge>;
  if (status === 'FAILED') return <Badge variant="danger" dot>Failed</Badge>;
  return <Badge variant="neutral" dot>{status}</Badge>;
}

export function SettlementView() {
  const { data, loading, error, reload } = useApiData<SettlementResponse>('/api/vendor/settlement');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justPaid, setJustPaid] = useState<SettlementResult | null>(null);

  const pendingBalance = data?.pendingBalance ?? 0;
  const minimumPayout = data?.minimumPayout ?? 50_000;
  const payoutFee = data?.payoutFee ?? 2_000;

  const parsedAmount = Math.floor(Number(amountInput.replace(/[^\d]/g, '')));
  const netPayout = Math.max(0, parsedAmount - payoutFee);
  const amountValid =
    Number.isFinite(parsedAmount) &&
    parsedAmount >= minimumPayout &&
    parsedAmount <= pendingBalance;
  const canSubmit = amountValid && !submitting;

  function openDialog() {
    setAmountInput(String(pendingBalance > 0 ? pendingBalance : ''));
    setSubmitError(null);
    setDialogOpen(true);
  }

  async function submitSettlement() {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await postJson<SettlementResult>('/api/vendor/settlement', {
        amount: parsedAmount,
      });
      setDialogOpen(false);
      setJustPaid(result);
      toast.success('Test settlement recorded', { description: result.message });
      reload();
    } catch (cause) {
      const message =
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not record the test settlement. Please try again.';
      setSubmitError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Settlement"
        title="Test settlements & balance"
        description="Review simulated earnings and settlements. No bank or mobile-money payout is sent."
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {justPaid ? (
        <Alert variant="success" title={`Test settlement recorded · ${formatTZS(justPaid.settlement.netAmount)}`}>
          {justPaid.message}
          <span className="mt-1 block font-mono text-[11px]">{justPaid.settlement.reference}</span>
        </Alert>
      ) : null}

      {loading && !data ? (
        <>
          <Skeleton className="h-[210px] w-full rounded-2xl" />
          <div className="grid gap-4 lg:grid-cols-3">
            <CardBlockSkeleton rows={3} />
            <div className="lg:col-span-2">
              <CardBlockSkeleton rows={4} />
            </div>
          </div>
        </>
      ) : null}

      {data ? (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')} aria-busy={loading}>
          <section className="balance-card p-5 sm:p-6" aria-label="Pending settlement balance">
            <div className="relative z-10 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-200/90">
                  Pending balance
                </p>
                <p className="tabular mt-2 text-[2rem] font-semibold tracking-[-0.045em] text-white sm:text-4xl">
                  {formatTZS(data.pendingBalance)}
                </p>
                <p className="mt-1.5 text-xs text-emerald-100/75">
                  Available after Kupon&apos;s 1% transaction share
                </p>
                <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-semibold text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Test record only · no money sent
                </div>
              </div>

              <div className="w-full space-y-3 rounded-2xl border border-white/10 bg-white/[0.07] p-4 backdrop-blur sm:w-64">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">
                    Total settled (test)
                  </p>
                  <p className="tabular mt-1 text-lg font-semibold text-white">
                    {formatTZS(data.totalSettled)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-200/70">
                    Saved payout account
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs font-medium text-white">
                    <Landmark className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{data.settlementAccount}</span>
                  </p>
                  <p className="mt-1 text-[10px] text-emerald-100/70">Not used by test settlements</p>
                </div>
                <Button
                  size="sm"
                  onClick={openDialog}
                  disabled={data.pendingBalance < minimumPayout}
                  className="w-full bg-white text-emerald-800 shadow-none hover:bg-emerald-50 disabled:bg-white/15 disabled:text-white/50"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Record test settlement
                </Button>
              </div>
            </div>
          </section>

          {data.pendingBalance <= 0 ? (
            <Alert variant="info" title="Nothing to settle yet">
              Test settlements unlock at {formatTZS(minimumPayout)}. A {formatTZS(payoutFee)} fee is split
              between the API and Kupon.
            </Alert>
          ) : null}

          <div className="grid min-w-0 gap-4 lg:grid-cols-3">
            <section className="card-surface min-w-0 overflow-hidden p-5">
              <SectionHeading title="How test settlement works" description="No real money moves" />
              <ol className="mt-4 min-w-0 space-y-3.5">
                {[
                  {
                    icon: ScanLine,
                    title: 'Students pay by QR',
                    body: 'Students see a 2.5% API fee at checkout. Kupon retains 1% of the food subtotal.',
                  },
                  {
                    icon: Banknote,
                    title: 'Record a test settlement',
                    body: `Withdraw at least ${formatTZS(minimumPayout)}. The ${formatTZS(payoutFee)} fee is split ${formatTZS(data.apiFee)} to the API and ${formatTZS(data.kuponFee)} to Kupon.`,
                  },
                  {
                    icon: BadgeCheck,
                    title: 'Review the record',
                    body: 'The net amount and both fee shares are recorded with a test reference.',
                  },
                ].map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-800">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{step.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] leading-relaxed text-slate-500">
                Test settlements are recorded immediately. No bank or mobile-money service is
                contacted, and no funds are sent.
              </div>
            </section>

            <section className="card-surface min-w-0 overflow-hidden p-5 lg:col-span-2">
              <SectionHeading
                title="Confirmed test orders"
                description="Recent orders included in the simulated balance"
                actionLabel="All sales"
                actionHref="/vendor/sales"
              />
              <div className="mt-3 min-w-0">
                <SaleList
                  sales={data.recentPayments}
                  emptyState={
                    <EmptyState
                      icon={ScanLine}
                      title="No confirmed orders yet"
                      description="Confirmed test orders will appear here and update the simulated balance."
                      compact
                      action={
                        <Button asChild size="sm">
                          <Link href="/vendor/scan">
                            <ScanLine />
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

          <section className="card-surface min-w-0 overflow-hidden">
            <div className="flex min-w-0 items-center justify-between gap-3 border-b border-slate-100 p-5">
              <div className="min-w-0">
                <h2 className="text-base font-semibold tracking-tight text-slate-900">
                  Test settlement history
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  {data.payouts.length} {data.payouts.length === 1 ? 'settlement' : 'settlements'}
                </p>
              </div>
              <span className="shrink-0">
                <Badge variant="neutral">
                  <Wallet className="h-3 w-3" />
                  {formatTZS(data.totalSettled)} lifetime
                </Badge>
              </span>
            </div>

            {data.payouts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={Wallet}
                  title="No test settlements yet"
                  description="Your first simulated settlement will appear here with its reference and record date."
                  compact
                  action={
                    data.pendingBalance >= minimumPayout ? (
                      <Button size="sm" onClick={openDialog}>
                        Record test settlement
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-slate-100 p-4 lg:hidden">
                  {data.payouts.map((payout) => (
                    <li key={payout.id} className="flex min-w-0 items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[11px] font-medium text-slate-600">
                          {payout.reference}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-500">
                          {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400">
                          {payout.paidAt ? `Recorded ${formatDate(payout.paidAt)}` : 'Not processed'}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <Money amount={payout.netAmount || payout.amount} />
                        <p className="mt-1 text-[10px] text-slate-400">
                          Gross {formatTZS(payout.amount)} · fee {formatTZS(payout.feeAmount)}
                        </p>
                        <div className="mt-1.5">
                          <PayoutStatusBadge status={payout.status} />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden lg:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Reference</TableHead>
                        <TableHead>Period</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Recorded</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.payouts.map((payout) => (
                        <TableRow key={payout.id}>
                          <TableCell className="font-mono text-[11px] text-slate-500">
                            {payout.reference}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-slate-600">
                            {formatDate(payout.periodStart)} – {formatDate(payout.periodEnd)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money amount={payout.netAmount || payout.amount} />
                            <p className="mt-1 text-[10px] text-slate-400">
                              Gross {formatTZS(payout.amount)} · fee {formatTZS(payout.feeAmount)}
                            </p>
                          </TableCell>
                          <TableCell>
                            <PayoutStatusBadge status={payout.status} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs text-slate-500">
                            {payout.paidAt ? formatDate(payout.paidAt) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (submitting) return;
          setDialogOpen(next);
          if (!next) setSubmitError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record test settlement</DialogTitle>
            <DialogDescription>
              Simulate a withdrawal from your pending balance. The {formatTZS(payoutFee)} fee is
              recorded as the API and Kupon split; no funds are sent to{' '}
              {data?.settlementAccount ?? 'a payout account'}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Available now
              </p>
              <p className="tabular mt-1 text-xl font-semibold text-slate-900">
                {formatTZS(pendingBalance)}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="settlement-amount">Gross amount to settle (TZS)</Label>
              <Input
                id="settlement-amount"
                type="number"
                inputMode="numeric"
                min={minimumPayout}
                max={pendingBalance}
                step={100}
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                error={amountInput !== '' && !amountValid}
                disabled={submitting}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
                <p className="text-[11px] text-slate-500">
                  Minimum {formatTZS(minimumPayout)} • maximum {formatTZS(pendingBalance)}
                </p>
                <button
                  type="button"
                  onClick={() => setAmountInput(String(pendingBalance))}
                  className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
                  disabled={submitting}
                >
                  Use full balance
                </button>
              </div>
              {amountInput !== '' && !amountValid ? (
                <p className="text-[11px] font-medium text-red-600">
                  Enter an amount between {formatTZS(minimumPayout)} and {formatTZS(pendingBalance)}.
                </p>
              ) : null}
              {amountValid ? (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-900">
                  Fee {formatTZS(payoutFee)} ({formatTZS(data?.apiFee ?? 1_500)} API +{' '}
                  {formatTZS(data?.kuponFee ?? 500)} Kupon) · recorded net {formatTZS(netPayout)}
                </div>
              ) : null}
            </div>

            {submitError ? <Alert variant="danger">{submitError}</Alert> : null}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={submitting}>
                Cancel
              </Button>
            </DialogClose>
            <Button onClick={submitSettlement} loading={submitting} disabled={!canSubmit}>
              <Banknote className="h-4 w-4" />
              Record {amountValid ? formatTZS(netPayout) : 'test settlement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
