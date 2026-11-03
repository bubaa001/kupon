'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  Info,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionHeading } from '@/components/ui/section-heading';
import { RefundStatusBadge } from '@/components/ui/status-badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { MIN_REQUEST_REASON, PAYOUT_STATUS_LABEL } from '@/lib/constants';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import { ErrorState } from '../_components/error-state';
import type { MoneyRequestApi, WithdrawalCreated, WithdrawalsData } from '../_lib/types';

function MoneyTabs({ active }: { active: 'withdrawals' | 'refunds' }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1" role="tablist">
      <Link
        href="/student/withdrawals"
        role="tab"
        aria-selected={active === 'withdrawals'}
        className={cn(
          'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
          active === 'withdrawals'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <Banknote className="h-4 w-4" aria-hidden />
        Cash out
      </Link>
      <Link
        href="/student/refunds"
        role="tab"
        aria-selected={active === 'refunds'}
        className={cn(
          'flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
          active === 'refunds'
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-800',
        )}
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        Order refunds
      </Link>
    </div>
  );
}

function WithdrawalsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-[196px] w-full rounded-xl" />
      <Card className="p-5">
        <Skeleton className="h-4 w-32" />
        <div className="mt-4 space-y-3">
          {[0, 1].map((index) => (
            <Skeleton key={index} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </Card>
    </div>
  );
}

function WithdrawalItem({ request }: { request: MoneyRequestApi }) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold tabular text-slate-900">
            {formatTZS(request.amount)}
          </p>
          <RefundStatusBadge status={request.status} />
          {request.payoutStatus ? (
            <Badge
              variant={
                request.payoutStatus === 'SETTLED'
                  ? 'success'
                  : request.payoutStatus === 'FAILED'
                    ? 'danger'
                    : 'warning'
              }
            >
              {PAYOUT_STATUS_LABEL[request.payoutStatus] ?? request.payoutStatus}
            </Badge>
          ) : null}
        </div>
        <p className="shrink-0 text-[10px] text-slate-400">
          {formatDateTime(request.createdAt)}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Ref: <span className="font-mono">{request.reference}</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{request.reason}</p>
      {request.adminNote ? (
        <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
          <span className="font-semibold text-slate-700">Maelezo ya admin: </span>
          {request.adminNote}
        </div>
      ) : null}
      {request.reviewedAt ? (
        <p className="mt-1.5 text-[10px] text-slate-400">
          Ilikaguliwa {formatDateTime(request.reviewedAt)}
        </p>
      ) : null}
    </div>
  );
}

export default function WithdrawalsPage() {
  const router = useRouter();

  const [data, setData] = useState<WithdrawalsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<WithdrawalsData>('/api/student/withdrawals'));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Imeshindikana kupakia maombi ya kutoa pesa.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const minAmount = data?.minAmount ?? 1000;
  const amount = Number(amountText.replace(/[^\d]/g, ''));
  const eligible = data?.eligibleAmount ?? 0;

  const amountError = !amount
    ? 'Weka kiasi cha kutoa.'
    : amount < minAmount
      ? `Kiwango cha chini ni ${formatTZS(minAmount)}.`
      : amount > eligible
        ? `Kiwango cha juu ni ${formatTZS(eligible)}.`
        : null;

  const reasonError =
    reason.trim().length < MIN_REQUEST_REASON
      ? 'Eleza kwa ufupi kwa nini unatoa pesa.'
      : null;

  function openDialog() {
    setAmountText('');
    setReason('');
    setFormError(null);
    setOpen(true);
  }

  async function submitRequest() {
    if (!data) return;
    if (amountError) {
      setFormError(amountError);
      return;
    }
    if (reasonError) {
      setFormError(reasonError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await postJson<WithdrawalCreated>('/api/student/withdrawals', {
        amount,
        reason: reason.trim(),
      });
      toast.success('Ombi la kutoa pesa limewasilishwa', {
        description: response.message,
      });
      setOpen(false);
      await load();
      router.refresh();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Ombi halikuweza kutumwa. Jaribu tena.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) return <WithdrawalsSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Cash out"
          title="Toa pesa"
          description="Ondoa salio la wallet kwenda kwenye mobile money yako. Admin wa chuo hukagua kila ombi."
        />
        <ErrorState
          message={error ?? 'Imeshindikana kupakia withdrawals.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const pendingRequest = data.requests.find((request) => request.status === 'PENDING');
  const canRequest = !data.hasPending && data.eligibleAmount >= minAmount;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cash out"
        title="Toa pesa"
        description="Toa salio la wallet kwenda kwenye mobile money yako. Pesa hutolewa tu baada ya admin wa chuo kuidhinisha ombi lako — hii si refund ya order."
      />

      <MoneyTabs active="withdrawals" />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
              Unaweza kutoa hadi
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular text-slate-900">
              {formatTZS(data.eligibleAmount)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Salio la wallet: {formatTZS(data.balance)}
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Banknote className="h-5 w-5" aria-hidden />
          </span>
        </div>

        {data.hasPending ? (
          <Alert variant="warning" title="Una ombi la kutoa linalosubiri" className="mt-4">
            Ombi la {formatTZS(pendingRequest?.amount ?? 0)} linasubiri admin wa chuo. Huwezi
            kuomba kutoa pesa tena mpaka ombi hili likamilike.
          </Alert>
        ) : canRequest ? (
          <Button className="mt-4 w-full" size="lg" onClick={openDialog}>
            <Banknote aria-hidden />
            Omba kutoa pesa
          </Button>
        ) : (
          <Alert variant="info" title="Hakuna salio la kutosha" className="mt-4">
            Kiwango cha chini cha kutoa ni {formatTZS(minAmount)}. Weka pesa kisha ujaribu tena.
          </Alert>
        )}
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="Maombi yako ya kutoa pesa"
          description="Cash-out requests na majibu ya admin"
        />
        <div className="mt-2">
          {data.requests.length === 0 ? (
            <EmptyState
              icon={Info}
              title="Hakuna maombi ya kutoa pesa"
              description="Ukiwa na salio ambalo hutalitumia, unaweza kuliomba likatumwe kwenye mobile money yako."
              compact
              action={
                canRequest ? (
                  <Button size="sm" onClick={openDialog}>
                    Omba kutoa pesa
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.requests.map((request) => (
                <WithdrawalItem key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Jinsi kutoa pesa kunavyofanya kazi
            </p>
            <ol className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  1
                </span>
                Weka ombi la kiasi unachotaka kutoa (kiwango cha chini{' '}
                {formatTZS(minAmount)}). Salio lako halibadiliki bado.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  2
                </span>
                Admin wa chuo hukagua ombi. Akikubali, salio lako hupunguzwa mara moja.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  3
                </span>
                Pesa hutumwa kwenye namba yako ya mobile money na risiti huwekwa kwenye historia.
              </li>
            </ol>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-[11px] leading-relaxed text-amber-800">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Kutoa pesa ni tofauti na refund ya order. Refund hurejesha pesa ya order
                iliyolipwa na vendor aliyethibitisha —{' '}
                <Link href="/student/refunds" className="font-semibold underline">
                  fungua order refunds
                </Link>
                .
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!submitting) setOpen(value);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Omba kutoa pesa</DialogTitle>
            <DialogDescription>
              Chagua kiasi cha kutoa kutoka wallet yako kwenda mobile money. Admin wa chuo
              atapitia ombi lako; pesa haitolewi mpaka idhini.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="withdrawal-amount">Kiasi cha kutoa</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  TZS
                </span>
                <Input
                  id="withdrawal-amount"
                  inputMode="numeric"
                  placeholder="Mfano 5000"
                  value={amountText}
                  onChange={(event) =>
                    setAmountText(event.target.value.replace(/[^\d]/g, '').slice(0, 7))
                  }
                  className="pl-11 tabular"
                  error={amountText.length > 0 && amountError ? true : undefined}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {[1000, 2000, 5000].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAmountText(String(value))}
                    disabled={value > eligible}
                    className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold tabular text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {formatTZS(value)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setAmountText(String(eligible))}
                  className="h-9 rounded-lg border border-primary-200 bg-primary-50 px-3 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                >
                  Max
                </button>
              </div>
              <p
                className={cn(
                  'text-[11px]',
                  amountText.length > 0 && amountError ? 'text-red-600' : 'text-slate-500',
                )}
              >
                {amountText.length > 0 && amountError
                  ? amountError
                  : `Unaweza kutoa hadi ${formatTZS(eligible)}.`}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="withdrawal-reason">Sababu</Label>
              <Textarea
                id="withdrawal-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value.slice(0, 300))}
                placeholder="Mfano: Nahitaji pesa taslimu kwa safari ya nyumbani mwishoni wa muhula."
              />
              <div className="flex items-center justify-between">
                <p
                  className={cn(
                    'text-[11px]',
                    reason.length > 0 && reasonError ? 'text-red-600' : 'text-slate-500',
                  )}
                >
                  {reason.length > 0 && reasonError
                    ? reasonError
                    : 'Admin anahitaji kuelewa sababu yako.'}
                </p>
                <p className="text-[11px] tabular text-slate-400">{reason.length}/300</p>
              </div>
            </div>

            {formError ? <Alert variant="danger">{formError}</Alert> : null}

            <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              Pesa hutumwa kwenye namba yako ya mobile money iliyosajiliwa baada ya admin
              kuidhinisha. Wallet yako hupunguzwa mara moja tu.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Ghairi
            </Button>
            <Button
              onClick={() => void submitRequest()}
              loading={submitting}
              disabled={submitting || !!amountError || !!reasonError || !amount}
            >
              Tuma ombi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
