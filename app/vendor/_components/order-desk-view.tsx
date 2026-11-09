'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Inbox,
  CheckCheck,
  PackageX,
  QrCode,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch, postJson } from '@/lib/client-api';
import type { OrderView, VendorOrdersData } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LoadError } from './feedback';
import { OrderCard } from './order-card';
import { VerifyCouponDialog } from './verify-coupon-dialog';

type TabKey = 'REQUESTS' | 'AWAITING_PAYMENT' | 'PENDING' | 'VERIFIED' | 'ALL';
type VerifyMode = 'code' | 'scan';
type VerifyTarget = { order: OrderView | null; mode: VerifyMode };

const POLL_MS = 3000;
const HIGHLIGHT_MS = 8000;

export function OrderDeskView({ basePath = '/vendor' }: { basePath?: string }) {
  const [data, setData] = useState<VendorOrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('REQUESTS');
  const [liveState, setLiveState] = useState<'live' | 'new' | 'reconnecting'>('live');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);
  const [unavailableOrder, setUnavailableOrder] = useState<OrderView | null>(null);
  const [unavailableReason, setUnavailableReason] = useState('');
  const [requestBusy, setRequestBusy] = useState<string | null>(null);
  const [acceptingAll, setAcceptingAll] = useState(false);
  const [reportingUnavailable, setReportingUnavailable] = useState(false);

  const dataRef = useRef<VendorOrdersData | null>(null);
  const knownPendingRef = useRef<Set<string> | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setLoading(true);
    try {
      const payload = await apiFetch<VendorOrdersData>('/api/vendor/orders?status=ALL');
      if (!mountedRef.current) return;

      const pendingIds = payload.orders
        .filter(
          (order) =>
            order.status === 'PENDING' ||
            order.status === 'AWAITING_ACCEPTANCE' ||
            order.status === 'AWAITING_PAYMENT',
        )
        .map((order) => order.id);
      const known = knownPendingRef.current;

      // Announce only orders that arrive after the first load, so opening the
      // desk does not toast the whole existing queue.
      if (known) {
        const fresh = pendingIds.filter((id) => !known.has(id));
        if (fresh.length > 0) {
          setNewIds((current) => new Set([...current, ...fresh]));
          setLiveState('new');
          if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = window.setTimeout(() => {
            setLiveState('live');
            setNewIds(new Set());
          }, HIGHLIGHT_MS);

          const requestCount = payload.orders.filter(
            (order) => fresh.includes(order.id) && order.status === 'AWAITING_ACCEPTANCE',
          ).length;
          const paymentWaitCount = payload.orders.filter(
            (order) => fresh.includes(order.id) && order.status === 'AWAITING_PAYMENT',
          ).length;
          toast.success(
            requestCount
              ? `${requestCount} new meal request${requestCount === 1 ? '' : 's'}`
              : paymentWaitCount
                ? `${paymentWaitCount} approved order${paymentWaitCount === 1 ? '' : 's'} awaiting payment`
                : fresh.length === 1
                  ? 'New coupon ready'
                  : `${fresh.length} coupons ready`,
            {
              description: requestCount
                ? 'Confirm availability. Students pay only after acceptance.'
                : paymentWaitCount
                  ? 'The student must complete payment before a coupon is issued.'
                : 'A student is waiting at the counter — verify their coupon.',
            },
          );
          try {
            navigator.vibrate?.([30, 40, 30]);
          } catch {
            /* Vibration is a bonus on supported devices. */
          }
        }
      }

      knownPendingRef.current = new Set(pendingIds);
      dataRef.current = payload;
      setData(payload);
      setError(null);
      setLiveState((current) => (current === 'new' ? current : 'live'));
    } catch (cause) {
      if (!mountedRef.current) return;
      setLiveState('reconnecting');
      if (!dataRef.current) {
        setError(
          cause instanceof Error && cause.message
            ? cause.message
            : 'The order desk could not connect. Check your connection and try again.',
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load(false);

    const tick = () => {
      if (document.visibilityState === 'hidden' || !mountedRef.current) return;
      void load(true);
    };
    const interval = window.setInterval(tick, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load(true);
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      if (highlightTimerRef.current) window.clearTimeout(highlightTimerRef.current);
    };
  }, [load]);

  const handleVerified = useCallback(
    (verified: OrderView) => {
      setData((previous) => {
        if (!previous) return previous;
        const existing = previous.orders.find((order) => order.id === verified.id);
        const wasPending = existing?.status === 'PENDING';
        const orders = existing
          ? previous.orders.map((order) => (order.id === verified.id ? verified : order))
          : [verified, ...previous.orders];

        return {
          orders,
          counts: {
            awaitingAcceptance: previous.counts.awaitingAcceptance,
            awaitingPayment: previous.counts.awaitingPayment,
            pending: Math.max(0, previous.counts.pending - (wasPending ? 1 : 0)),
            verified: previous.counts.verified + (wasPending ? 1 : 0),
            today: previous.counts.today,
          },
        };
      });
      setNewIds((current) => {
        const next = new Set(current);
        next.delete(verified.id);
        return next;
      });
      // Reconcile with the server in the background (keeps counts honest).
      void load(true);
    },
    [load],
  );

  const orders = useMemo(() => {
    const rows = data?.orders ?? [];
    if (tab === 'ALL') return rows;
    if (tab === 'REQUESTS') {
      return rows.filter((order) => order.status === 'AWAITING_ACCEPTANCE');
    }
    if (tab === 'AWAITING_PAYMENT') {
      return rows.filter((order) => order.status === 'AWAITING_PAYMENT');
    }
    return rows.filter((order) => order.status === tab);
  }, [data, tab]);

  const counts = data?.counts ?? {
    awaitingAcceptance: 0,
    awaitingPayment: 0,
    pending: 0,
    verified: 0,
    today: 0,
  };
  const requestGroups = useMemo(() => {
    const groups = new Map<string, number>();
    for (const order of data?.orders ?? []) {
      if (order.status !== 'AWAITING_ACCEPTANCE') continue;
      for (const item of order.items) {
        groups.set(item.name, (groups.get(item.name) ?? 0) + item.quantity);
      }
    }
    return Array.from(groups, ([name, quantity]) => ({ name, quantity })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [data]);
  const newCount = newIds.size;
  const stale = liveState === 'reconnecting' && Boolean(data);

  const liveTone =
    liveState === 'new'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : stale
        ? 'border-rose-200 bg-rose-50 text-rose-700'
        : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  function openVerify(order: OrderView | null, mode: VerifyMode) {
    setVerifyTarget({ order, mode });
  }

  async function acceptRequest(order: OrderView) {
    setRequestBusy(order.id);
    try {
      await postJson(`/api/vendor/orders/${encodeURIComponent(order.id)}/accept`, {});
      toast.success(`${order.items.map((item) => item.name).join(', ')} accepted`, {
        description: 'The student can now pay. The coupon will appear after payment is confirmed.',
      });
      await load(true);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not accept this request.');
    } finally {
      setRequestBusy(null);
    }
  }

  async function acceptAllRequests() {
    setAcceptingAll(true);
    try {
      const result = await postJson<{ accepted: number }>('/api/vendor/orders/accept-all', {});
      toast.success(`${result.accepted} request${result.accepted === 1 ? '' : 's'} accepted`);
      await load(true);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not accept all requests.');
    } finally {
      setAcceptingAll(false);
    }
  }

  async function reportUnavailable() {
    if (!unavailableOrder || unavailableReason.trim().length < 5) return;
    setReportingUnavailable(true);
    try {
      const result = await postJson<{ status: string; message?: string }>(
        `/api/vendor/orders/${encodeURIComponent(unavailableOrder.id)}/unavailable`,
        { reason: unavailableReason.trim() },
      );
      toast.success(
        result.status === 'CANCELLED' ? 'Unpaid request declined' : 'Credit case sent for review',
        {
          description:
            result.message ??
            'The finance team and platform admin can review the reason and case history.',
        },
      );
      setUnavailableOrder(null);
      setUnavailableReason('');
      await load(true);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Could not send this credit request.');
    } finally {
      setReportingUnavailable(false);
    }
  }

  const emptyState = (
    <EmptyState
      icon={
        tab === 'REQUESTS'
          ? Inbox
          : tab === 'PENDING'
            ? CheckCircle2
            : tab === 'AWAITING_PAYMENT'
              ? Clock3
            : tab === 'VERIFIED'
              ? CheckCircle2
              : ClipboardCheck
      }
      title={
        tab === 'REQUESTS'
          ? 'No meal requests waiting'
          : tab === 'PENDING'
            ? 'No coupons ready'
            : tab === 'AWAITING_PAYMENT'
              ? 'No approved orders awaiting payment'
          : tab === 'VERIFIED'
            ? 'No verified coupons yet'
            : 'No orders yet'
      }
      description={
        tab === 'REQUESTS'
          ? 'Meal requests wait here for staff to confirm that the food is available. The student pays after acceptance.'
          : tab === 'AWAITING_PAYMENT'
            ? 'These orders were approved by staff. Students must complete payment before their coupon becomes available.'
          : tab === 'PENDING'
            ? 'Paid orders appear here. Ask the student to show their coupon before handing over the food.'
          : tab === 'VERIFIED'
            ? 'Coupons you verify move here so you can always look up what was collected and when.'
            : 'Students order by scanning the counter QR on your home screen. Orders appear here automatically.'
      }
      action={
        tab !== 'VERIFIED' ? (
          <Button asChild variant="outline" size="sm">
            <Link href={basePath}>
              <QrCode className="h-4 w-4" />
              Show menu QR
            </Link>
          </Button>
        ) : undefined
      }
    />
  );

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order desk"
        title="Order & coupon desk"
        description="Check each request against current stock. Students pay only after staff accept; only paid orders receive a coupon."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRefreshing(true);
                void load(true);
              }}
              disabled={refreshing}
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Refresh
            </Button>
            <Button size="sm" onClick={() => openVerify(null, 'scan')}>
              <QrCode className="h-4 w-4" />
              Verify by QR
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide',
            liveTone,
          )}
        >
          {stale ? (
            <WifiOff className="h-3 w-3" />
          ) : (
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                liveState === 'new' ? 'bg-amber-500' : 'bg-emerald-500',
              )}
            />
          )}
          {liveState === 'new'
            ? `${newCount} new ${newCount === 1 ? 'order' : 'orders'}`
            : stale
              ? 'Reconnecting…'
              : 'Live'}
        </span>
        <p className="flex items-center gap-1 text-[11px] text-slate-500">
          <Wifi className="h-3 w-3" />
          Updates every 3 seconds while this screen is open
        </p>
      </div>

      {error && !data ? <LoadError message={error} onRetry={() => void load(false)} /> : null}

      {stale ? (
        <Alert variant="warning" title="Live updates paused">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>We could not reach the order desk. Orders are safe — retrying automatically.</span>
            <Button size="sm" variant="outline" onClick={() => void load(true)}>
              Retry now
            </Button>
          </span>
        </Alert>
      ) : null}

      {loading && !data ? (
        <>
          <div className="grid min-w-0 grid-cols-3 gap-2.5">
            {[0, 1, 2].map((index) => (
              <div key={index} className="card-surface min-w-0 p-3.5">
                <Skeleton className="h-3 w-14" />
                <Skeleton className="mt-2 h-6 w-8" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="card-surface min-w-0 p-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-14 w-14 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-2/3" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-14 w-full" />
              </div>
            ))}
          </div>
        </>
      ) : null}

      {data ? (
        <div className={cn('space-y-4 transition-opacity', refreshing && 'opacity-70')} aria-busy={refreshing}>
          <div className="grid min-w-0 grid-cols-3 gap-2.5">
            <CountTile
              label="Requests"
              value={counts.awaitingAcceptance}
              icon={Inbox}
              tone="amber"
              highlight={counts.awaitingAcceptance > 0}
            />
            <CountTile label="Ready" value={counts.pending} icon={Clock3} tone="sky" />
            <CountTile label="Today" value={counts.today} icon={CalendarDays} tone="sky" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
              <TabsList className="grid h-12 w-full grid-cols-5 p-1 sm:h-11 sm:w-[38rem]">
                <TabsTrigger
                  value="REQUESTS"
                  aria-label={`Requests (${counts.awaitingAcceptance})`}
                  className="min-h-11 gap-1 px-1.5 text-[11px] sm:px-3 sm:text-xs"
                >
                  <span className="sm:hidden">Req</span>
                  <span className="hidden sm:inline">Requests</span>
                  <TabCount value={counts.awaitingAcceptance} active={tab === 'REQUESTS'} />
                </TabsTrigger>
                <TabsTrigger
                  value="AWAITING_PAYMENT"
                  aria-label={`Awaiting payment (${counts.awaitingPayment})`}
                  className="min-h-11 gap-1 px-1.5 text-[11px] sm:px-3 sm:text-xs"
                >
                  Pay
                  <TabCount value={counts.awaitingPayment} active={tab === 'AWAITING_PAYMENT'} />
                </TabsTrigger>
                <TabsTrigger
                  value="PENDING"
                  aria-label={`Ready (${counts.pending})`}
                  className="min-h-11 gap-1 px-1.5 text-[11px] sm:px-3 sm:text-xs"
                >
                  Ready
                  <TabCount value={counts.pending} active={tab === 'PENDING'} />
                </TabsTrigger>
                <TabsTrigger
                  value="VERIFIED"
                  aria-label={`Verified (${counts.verified})`}
                  className="min-h-11 gap-1 px-1.5 text-[11px] sm:px-3 sm:text-xs"
                >
                  <span className="sm:hidden">Done</span>
                  <span className="hidden sm:inline">Verified</span>
                  <TabCount value={counts.verified} active={tab === 'VERIFIED'} />
                </TabsTrigger>
                <TabsTrigger
                  value="ALL"
                  aria-label={`All orders (${data.orders.length})`}
                  className="min-h-11 gap-1 px-1.5 text-[11px] sm:px-3 sm:text-xs"
                >
                  All
                  <TabCount value={data.orders.length} active={tab === 'ALL'} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-[11px] text-slate-500">
              {tab === 'REQUESTS'
                ? `${orders.length} request${orders.length === 1 ? '' : 's'} need a decision`
                : tab === 'PENDING'
                  ? `${orders.length} coupon${orders.length === 1 ? '' : 's'} ready to verify`
                : tab === 'VERIFIED'
                  ? `${orders.length} verified coupon${orders.length === 1 ? '' : 's'}`
                  : `${orders.length} order${orders.length === 1 ? '' : 's'} in this window`}
            </p>
          </div>

          {tab === 'REQUESTS' && orders.length > 0 ? (
            <section className="card-surface flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-900">Requests grouped by food</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {requestGroups.map((group) => (
                    <span
                      key={group.name}
                      className="rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1 text-[11px] text-sky-800"
                    >
                      {group.name} · {group.quantity}
                    </span>
                  ))}
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => void acceptAllRequests()}
                disabled={acceptingAll || counts.awaitingAcceptance === 0}
              >
                <CheckCheck className="h-4 w-4" />
                Accept all
              </Button>
            </section>
          ) : null}

          {orders.length === 0 ? (
            <div className="card-surface min-w-0 p-4">{emptyState}</div>
          ) : (
            <ul className="space-y-3">
              {orders.map((order, index) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  isNew={newIds.has(order.id)}
                  animationDelay={Math.min(index, 6) * 40}
                  onEnterCode={(selected) => openVerify(selected, 'code')}
                  onScanQr={(selected) => openVerify(selected, 'scan')}
                  onAcceptRequest={(selected) => void acceptRequest(selected)}
                  busy={requestBusy === order.id}
                  onReportUnavailable={(selected) => {
                    setUnavailableOrder(selected);
                    setUnavailableReason('Food is no longer available.');
                  }}
                />
              ))}
            </ul>
          )}

          {orders.length > 0 ? (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <ScanLine className="h-3.5 w-3.5" />
              Coupon codes stay hidden until verification — always check the student&apos;s phone.
            </p>
          ) : null}
        </div>
      ) : null}

      <VerifyCouponDialog
        open={verifyTarget !== null}
        onOpenChange={(next) => {
          if (!next) setVerifyTarget(null);
        }}
        order={verifyTarget?.order ?? null}
        initialMode={verifyTarget?.mode ?? 'code'}
        onVerified={handleVerified}
      />

      <Dialog
        open={unavailableOrder !== null}
        onOpenChange={(open) => {
          if (!reportingUnavailable && !open) {
            setUnavailableOrder(null);
            setUnavailableReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report food as unavailable</DialogTitle>
            <DialogDescription>
              Send this paid order to the platform admin for a cafeteria credit decision. The
              student will not receive a coupon while the case is open.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={unavailableReason}
            onChange={(event) => setUnavailableReason(event.target.value.slice(0, 500))}
            placeholder="Explain what could not be served"
            maxLength={500}
            aria-label="Reason food is unavailable"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnavailableOrder(null);
                setUnavailableReason('');
              }}
              disabled={reportingUnavailable}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void reportUnavailable()}
              disabled={reportingUnavailable || unavailableReason.trim().length < 5}
              loading={reportingUnavailable}
            >
              <PackageX className="h-4 w-4" />
              Send to admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabCount({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={cn(
        'tabular rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
        active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200/70 text-slate-500',
      )}
    >
      {value}
    </span>
  );
}

const TONES = {
  amber: 'border-amber-200 bg-amber-50/70 text-amber-700',
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-700',
  sky: 'border-sky-200 bg-sky-50/70 text-sky-700',
} as const;

function CountTile({
  label,
  value,
  icon: Icon,
  tone,
  highlight,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  tone: keyof typeof TONES;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        'card-surface min-w-0 overflow-hidden p-3.5',
        highlight && 'animate-status-pulse border-amber-200',
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border', TONES[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <p className="tabular mt-1.5 text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
