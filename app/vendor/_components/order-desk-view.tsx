'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Inbox,
  QrCode,
  RefreshCw,
  ScanLine,
  Wifi,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/client-api';
import type { OrderView, VendorOrdersData } from '@/lib/orders/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LoadError } from './feedback';
import { OrderCard } from './order-card';
import { VerifyCouponDialog } from './verify-coupon-dialog';

type TabKey = 'PENDING' | 'VERIFIED' | 'ALL';
type VerifyMode = 'code' | 'scan';
type VerifyTarget = { order: OrderView | null; mode: VerifyMode };

const POLL_MS = 3000;
const HIGHLIGHT_MS = 8000;

export function OrderDeskView({ basePath = '/vendor' }: { basePath?: string }) {
  const [data, setData] = useState<VendorOrdersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('PENDING');
  const [liveState, setLiveState] = useState<'live' | 'new' | 'reconnecting'>('live');
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [verifyTarget, setVerifyTarget] = useState<VerifyTarget | null>(null);

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
        .filter((order) => order.status === 'PENDING')
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

          toast.success(
            fresh.length === 1 ? 'New order received' : `${fresh.length} new orders received`,
            {
              description: 'A student is waiting at the counter — verify their coupon.',
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
    return rows.filter((order) => order.status === tab);
  }, [data, tab]);

  const counts = data?.counts ?? { pending: 0, verified: 0, today: 0 };
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

  const emptyState = (
    <EmptyState
      icon={
        tab === 'PENDING' ? Inbox : tab === 'VERIFIED' ? CheckCircle2 : ClipboardCheck
      }
      title={
        tab === 'PENDING'
          ? 'No orders waiting'
          : tab === 'VERIFIED'
            ? 'No verified coupons yet'
            : 'No orders yet'
      }
      description={
        tab === 'PENDING'
          ? 'When a student scans your counter QR and pays, their order appears here live. Keep this screen open during service.'
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
        title="Verify student coupons"
        description="Students scan your counter QR, complete Kupon test checkout, then show their meal coupon. Verify it here before handing over the food."
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
                liveState === 'new' ? 'bg-amber-500' : 'animate-pulse bg-emerald-500',
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
              label="Pending"
              value={counts.pending}
              icon={Clock3}
              tone="amber"
              highlight={counts.pending > 0}
            />
            <CountTile label="Verified" value={counts.verified} icon={CheckCircle2} tone="emerald" />
            <CountTile label="Today" value={counts.today} icon={CalendarDays} tone="sky" />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
              <TabsList className="grid w-full grid-cols-3 sm:w-[26rem]">
                <TabsTrigger value="PENDING" className="gap-1 px-2 text-xs sm:px-3">
                  Incoming
                  <TabCount value={counts.pending} active={tab === 'PENDING'} />
                </TabsTrigger>
                <TabsTrigger value="VERIFIED" className="gap-1 px-2 text-xs sm:px-3">
                  Verified
                  <TabCount value={counts.verified} active={tab === 'VERIFIED'} />
                </TabsTrigger>
                <TabsTrigger value="ALL" className="gap-1 px-2 text-xs sm:px-3">
                  All
                  <TabCount value={data.orders.length} active={tab === 'ALL'} />
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-[11px] text-slate-500">
              {tab === 'PENDING'
                ? `${orders.length} waiting for coupon verification`
                : tab === 'VERIFIED'
                  ? `${orders.length} verified coupon${orders.length === 1 ? '' : 's'}`
                  : `${orders.length} order${orders.length === 1 ? '' : 's'} in this window`}
            </p>
          </div>

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
