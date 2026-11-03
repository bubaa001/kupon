'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Banknote,
  CheckCircle2,
  Info,
  PackageX,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { MIN_REQUEST_REASON } from '@/lib/constants';
import { cn, formatDateTime, formatTZS } from '@/lib/utils';
import { ErrorState } from '../_components/error-state';
import type {
  MoneyRequestApi,
  OrderRefundsData,
  RefundableOrder,
  RefundCreated,
} from '../_lib/types';

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

function RefundsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-[220px] w-full rounded-xl" />
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

function OrderRefundItem({ request }: { request: MoneyRequestApi }) {
  return (
    <div className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <p className="text-sm font-semibold tabular text-slate-900">
            {formatTZS(request.amount)}
          </p>
          <RefundStatusBadge status={request.status} />
        </div>
        <p className="shrink-0 text-[10px] text-slate-400">
          {formatDateTime(request.createdAt)}
        </p>
      </div>
      <p className="mt-1 text-[11px] text-slate-400">
        Ref: <span className="font-mono">{request.reference}</span>
        {request.orderReference ? (
          <>
            {' · Order: '}
            <span className="font-mono">{request.orderReference}</span>
          </>
        ) : null}
      </p>
      {request.vendorName || request.itemSummary ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {request.vendorName ?? 'Vendor'}
          {request.itemSummary ? ` • ${request.itemSummary}` : ''}
        </p>
      ) : null}
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

function orderState(request: RefundableOrder): {
  label: string;
  variant: 'success' | 'warning' | 'neutral';
  requestable: boolean;
} {
  if (request.refundRequestStatus === 'APPROVED') {
    return { label: 'Imerejeshwa', variant: 'success', requestable: false };
  }
  if (request.refundRequestStatus === 'PENDING') {
    return { label: 'Inasubiri admin', variant: 'warning', requestable: false };
  }
  return { label: 'Inaweza kuombewa refund', variant: 'neutral', requestable: true };
}

function RefundableOrderCard({
  order,
  onRequest,
}: {
  order: RefundableOrder;
  onRequest: (order: RefundableOrder) => void;
}) {
  const state = orderState(order);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{order.vendorName}</p>
            <Badge variant={state.variant}>{state.label}</Badge>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Order <span className="font-mono">{order.reference}</span>
            {order.verifiedAt ? ` • imethibitishwa ${formatDateTime(order.verifiedAt)}` : ''}
          </p>
          {order.itemSummary ? (
            <p className="mt-1 text-[11px] text-slate-500">{order.itemSummary}</p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular text-slate-900">
            {formatTZS(order.total)}
          </p>
          <p className="text-[10px] text-slate-400">{order.itemCount} item(s)</p>
        </div>
      </div>
      {state.requestable ? (
        <Button className="mt-3 w-full" size="sm" onClick={() => onRequest(order)}>
          <RotateCcw aria-hidden />
          Omba refund ya order hii
        </Button>
      ) : (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
          {state.variant === 'warning'
            ? `Ombi ${order.refundRequestReference ?? ''} linasubiri admin wa chuo. Huwezi kuomba refund nyingine kwa order hii.`
            : 'Order hii ilirejeshwa tayari. Pesa ipo kwenye wallet yako.'}
        </p>
      )}
    </div>
  );
}

export default function OrderRefundsPage() {
  const router = useRouter();

  const [data, setData] = useState<OrderRefundsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<RefundableOrder | null>(null);
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<OrderRefundsData>('/api/student/refunds'));
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Imeshindikana kupakia maombi ya refund.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reasonError =
    reason.trim().length < MIN_REQUEST_REASON
      ? 'Eleza kwa ufupi tatizo la order hii.'
      : null;

  function openDialog(order: RefundableOrder) {
    setSelected(order);
    setReason('');
    setFormError(null);
  }

  async function submitRequest() {
    if (!selected) return;
    if (reasonError) {
      setFormError(reasonError);
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const response = await postJson<RefundCreated>('/api/student/refunds', {
        orderId: selected.id,
        reason: reason.trim(),
      });
      toast.success('Ombi la refund ya order limewasilishwa', {
        description: response.message,
      });
      setSelected(null);
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

  if (loading && !data) return <RefundsSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Order refunds"
          title="Rejesha pesa ya order"
          description="Omba refund kwa order uliyolipa na vendor aliyethibitisha."
        />
        <ErrorState
          message={error ?? 'Imeshindikana kupakia refunds.'}
          onRetry={() => void load()}
        />
      </div>
    );
  }

  const requestable = data.refundableOrders.filter(
    (order) => order.refundRequestStatus === 'NONE',
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order refunds"
        title="Rejesha pesa ya order"
        description="Refund hurejesha pesa ya order maalum uliyolipa na vendor aliyethibitisha. Pesa hii inarudi kwenye wallet yako — si kutoa pesa kwenda mobile money."
      />

      <MoneyTabs active="refunds" />

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
              Salio la wallet
            </p>
            <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular text-slate-900">
              {formatTZS(data.balance)}
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
              <ReceiptText className="h-3.5 w-3.5" aria-hidden />
              Refund hurejesha kiasi cha order kwenye wallet, si kwenye mobile money.
            </p>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <RotateCcw className="h-5 w-5" aria-hidden />
          </span>
        </div>
        <Alert variant="info" title="Unatafuta kutoa pesa?" className="mt-4">
          Kama unataka kutoa salio lako kwenda mobile money, tumia{' '}
          <Link href="/student/withdrawals" className="font-semibold underline">
            Cash out
          </Link>
          . Refund hii ni kwa order iliyolipwa tu.
        </Alert>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="Order zako zilizothibitishwa"
          description="Chagua order yenye tatizo ili kuomba irejeshewe"
        />
        <div className="mt-3">
          {data.refundableOrders.length === 0 ? (
            <EmptyState
              icon={PackageX}
              title="Hakuna order iliyothibitishwa"
              description="Refund inapatikana tu kwa order ambayo vendor ameithibitisha. Order inayosubiri ithibitishwe inaweza kughairiwa kwenye coupon yako."
              compact
              action={
                <Button asChild size="sm" variant="outline">
                  <Link href="/student/pay">Nenda kwenye coupon</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {data.refundableOrders.map((order) => (
                <RefundableOrderCard key={order.id} order={order} onRequest={openDialog} />
              ))}
            </div>
          )}
        </div>
        {data.refundableOrders.length > 0 && requestable.length === 0 ? (
          <p className="mt-3 text-[11px] text-slate-400">
            Order zote zilizothibitishwa zina ombi la refund linalosubiri au zilirejeshwa
            tayari.
          </p>
        ) : null}
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="Maombi yako ya order refund"
          description="Maombi ya refund na majibu ya admin"
        />
        <div className="mt-2">
          {data.requests.length === 0 ? (
            <EmptyState
              icon={Info}
              title="Hakuna maombi ya refund"
              description="Ukiwa na order iliyothibitishwa yenye tatizo, unaweza kuomba irejeshewe hapa."
              compact
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {data.requests.map((request) => (
                <OrderRefundItem key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">
              Jinsi order refund inavyofanya kazi
            </p>
            <ol className="mt-2 space-y-2 text-xs leading-relaxed text-slate-500">
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  1
                </span>
                Chagua order iliyothibitishwa na vendor na ueleze tatizo.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  2
                </span>
                Admin wa chuo hukagua order, malipo ya awali na maelezo yako.
              </li>
              <li className="flex gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  3
                </span>
                Ikikubaliwa, kiasi cha order kinarejeshwa kwenye wallet yako mara moja na
                risiti huwekwa kwenye historia.
              </li>
            </ol>
            <div className="mt-3 flex items-start gap-2 rounded-lg bg-sky-50 p-3 text-[11px] leading-relaxed text-sky-800">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>
                Order ambayo vendor hajathibitisha bado inaweza kughairiwa moja kwa moja
                kwenye coupon yako — hiyo ni njia tofauti na refund hii.
              </span>
            </div>
          </div>
        </div>
      </Card>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(value) => {
          if (!submitting && !value) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Omba refund ya order</DialogTitle>
            <DialogDescription>
              Kiasi cha refund ni jumla ya order iliyothibitishwa. Admin wa chuo atapitia ombi
              lako kabla ya kurejesha pesa.
            </DialogDescription>
          </DialogHeader>

          {selected ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Order ya kurejesha
                    </p>
                    <p className="mt-1 font-mono text-xs font-semibold text-slate-800">
                      {selected.reference}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{selected.vendorName}</p>
                    {selected.itemSummary ? (
                      <p className="mt-1 text-[11px] text-slate-500">{selected.itemSummary}</p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Kiasi
                    </p>
                    <p className="mt-1 text-lg font-semibold tabular text-slate-900">
                      {formatTZS(selected.total)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="order-refund-reason">Tatizo la order</Label>
                <Textarea
                  id="order-refund-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value.slice(0, 300))}
                  placeholder="Mfano: Chakula hakikufika au kilikuwa tofauti na nilichoagiza."
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
                      : 'Admin anahitaji kuelewa tatizo la order hii.'}
                  </p>
                  <p className="text-[11px] tabular text-slate-400">{reason.length}/300</p>
                </div>
              </div>

              {formError ? <Alert variant="danger">{formError}</Alert> : null}

              <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
                Ikikubaliwa, {formatTZS(selected.total)} itarejeshwa kwenye wallet yako mara
                moja. Vendor hupunguzwa kwenye pending settlement yake.
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSelected(null)}
              disabled={submitting}
            >
              Ghairi
            </Button>
            <Button
              onClick={() => void submitRequest()}
              loading={submitting}
              disabled={submitting || !!reasonError || !selected}
            >
              Tuma ombi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
