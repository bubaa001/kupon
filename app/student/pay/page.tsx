'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  MapPin,
  ScanLine,
  ShoppingBag,
  Smartphone,
  Store,
  UtensilsCrossed,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FoodProductCard } from '@/components/food';
import { FoodThumb } from '@/components/orders/food-thumb';
import { FoodCoupon } from '@/components/orders/food-coupon';
import { PendingOrderDeck } from '@/components/student/pending-order-deck';
import { QrScanner } from '@/components/qr/qr-scanner';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { cn, formatTZS } from '@/lib/utils';
import type {
  OrderView,
  PlaceOrderInput,
  StudentOrdersData,
  VendorMenuData,
} from '@/lib/orders/types';
import { testPaymentSecondsRemaining } from '@/lib/orders/payment-ttl';
import { parseVendorQr } from '@/lib/orders/qr-payload';
import type { StudentCheckoutData, StudentDashboardData } from '../_lib/types';
import { ErrorState } from '../_components/error-state';

type Phase = 'boot' | 'scan' | 'menu' | 'payment' | 'payment-failed' | 'coupon';

type PlaceOrderResponse = {
  order: OrderView;
  transactionId: string | null;
  payment: {
    status: 'PENDING' | 'SETTLED';
    message: string;
    demo: boolean;
  };
};

type MenuItem = VendorMenuData['items'][number];

const PAYMENT_STAGES = [
  { id: 'INITIATED', label: 'Request created' },
  { id: 'RECEIVED', label: 'Payment received' },
  { id: 'CONFIRMED', label: 'Payment confirmed' },
] as const;

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
}

function PaySkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-16 w-full rounded-xl" />
      <Skeleton className="h-[280px] w-full rounded-xl" />
      <Skeleton className="h-[180px] w-full rounded-xl" />
    </div>
  );
}

function PayingPanel() {
  return (
    <div className="flex flex-col items-center py-8 text-center">
      <span className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-primary-200/60" aria-hidden />
        <span className="relative flex h-16 w-16 animate-soft-float items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <UtensilsCrossed className="h-7 w-7" aria-hidden />
        </span>
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900">Kupon test gateway inachakata…</p>
      <p className="mt-1 max-w-[16rem] text-xs leading-relaxed text-slate-500">
        Gateway itaandika malipo yamepokelewa na kuthibitishwa kiotomatiki. Hakuna pesa halisi
        inayokusanywa.
      </p>
      <p className="mt-4 flex items-center gap-2 text-[11px] text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Inafanya kazi…
      </p>
    </div>
  );
}

export default function PayPage() {
  const [phase, setPhase] = useState<Phase>('boot');
  const [bootError, setBootError] = useState<string | null>(null);
  const [student, setStudent] = useState<StudentDashboardData['student'] | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');
  const [useCredit, setUseCredit] = useState(false);
  const [campusVendors, setCampusVendors] = useState<StudentCheckoutData['vendors']>([]);
  const [vendorLoadError, setVendorLoadError] = useState(false);

  const [scanActive, setScanActive] = useState(false);
  const [scanningBusy, setScanningBusy] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');

  const [menu, setMenu] = useState<VendorMenuData | null>(null);
  const [category, setCategory] = useState('Zote');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [reviewOpen, setReviewOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);

  // Paid coupons waiting for the vendor live on the scan screen as a card deck.
  const [pendingOrders, setPendingOrders] = useState<OrderView[]>([]);
  const [pendingPaymentOrders, setPendingPaymentOrders] = useState<OrderView[]>([]);
  const [clockNow, setClockNow] = useState(Date.now());
  const [pendingLoading, setPendingLoading] = useState(true);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const loadBoot = useCallback(async () => {
    setPhase('boot');
    setBootError(null);
    setPendingLoading(true);
    try {
      const data = await apiFetch<StudentCheckoutData>('/api/student/checkout');
      setStudent(data.student);
      setCampusVendors(data.vendors);
      setVendorLoadError(data.vendorLoadError);
      const pending = data.orders.filter((entry) => entry.status === 'PENDING');
      const paymentWaiting = data.orders.filter((entry) => entry.status === 'PAYMENT_PENDING');
      setPendingOrders(pending);
      setPendingPaymentOrders(paymentWaiting);
      setPendingError(null);
      setPendingLoading(false);

      // A pending test payment never blocks scanning or placing another order.
      if (pending.length === 1 && paymentWaiting.length === 0) {
        setOrder(pending[0]);
        setPhase('coupon');
      } else {
        setPhase('scan');
      }
    } catch (error) {
      setPendingError(
        error instanceof ApiClientError
          ? error.message
          : 'Imeshindikana kupakia coupons zako. Angalia muunganisho wako kisha ujaribu tena.',
      );
      setBootError(
        error instanceof ApiClientError
          ? error.message
          : 'Imeshindikana kupakia taarifa zako. Angalia muunganisho wako kisha ujaribu tena.',
      );
      setPendingLoading(false);
      setPhase('scan');
    }
  }, []);

  useEffect(() => {
    void loadBoot();
  }, [loadBoot]);

  const refreshPending = useCallback(async (silent = false) => {
    if (!silent) setPendingLoading(true);
    try {
      const data = await apiFetch<StudentOrdersData>('/api/student/orders?status=ALL');
      setPendingOrders(data.orders.filter((entry) => entry.status === 'PENDING'));
      setPendingPaymentOrders(data.orders.filter((entry) => entry.status === 'PAYMENT_PENDING'));
      setPendingError(null);
    } catch (err) {
      setPendingError(
        err instanceof ApiClientError
          ? err.message
          : 'Imeshindikana kupakia coupons zako. Jaribu tena.',
      );
    } finally {
      if (!silent) setPendingLoading(false);
    }
  }, []);

  useEffect(() => {
    if (phase !== 'payment' && pendingPaymentOrders.length === 0) return;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [phase, pendingPaymentOrders.length]);

  useEffect(() => {
    if (phase !== 'scan' || pendingPaymentOrders.length === 0) return;
    const timer = window.setInterval(() => void refreshPending(true), 3000);
    return () => window.clearInterval(timer);
  }, [phase, pendingPaymentOrders.length, refreshPending]);

  const openCoupon = useCallback((next: OrderView) => {
    setOrder(next);
    setPhase('coupon');
  }, []);

  const scanVendor = useCallback(
    async (payload: { token?: string; code?: string }) => {
      if (scanningBusy) return;
      setScanningBusy(true);
      setScanError(null);
      if (payload.code) setBusyCode(payload.code);
      try {
        const data = await postJson<VendorMenuData>('/api/student/vendor-scan', payload);
        setMenu(data);
        setCart({});
        setUseCredit(false);
        setCategory('Zote');
        setNote('');
        setFormError(null);
        setReviewOpen(false);
        setScanActive(false);
        setCodeInput('');
        setPhase('menu');
        vibrate(30);
        toast.success(`${data.vendor.name} • menu imepakiwa`, {
          description: `${data.items.length} vyakula vinapatikana. Chagua chakula chako.`,
        });
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : 'Imeshindikana kupakia menu ya vendor. Jaribu tena.';
        setScanError(message);
        setScanActive(false);
        toast.error(message);
      } finally {
        setScanningBusy(false);
        setBusyCode(null);
      }
    },
    [scanningBusy],
  );

  const handleQrResult = useCallback(
    (value: string) => {
      const vendorCode = parseVendorQr(value);
      // New compact QR contains the public vendor code. Old printed QRs still
      // carry a signed JWT, so keep the token fallback for compatibility.
      void scanVendor(vendorCode ? { code: vendorCode } : { token: value });
    },
    [scanVendor],
  );

  const resetToScan = useCallback(() => {
    setOrder(null);
    setMenu(null);
    setCart({});
    setCategory('Zote');
    setNote('');
    setReviewOpen(false);
    setFormError(null);
    setPaymentMessage('');
    setScanError(null);
    setScanActive(false);
    setCodeInput('');
    setPhase('scan');
    void refreshPending();
  }, [refreshPending]);

  function submitCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = codeInput.trim().toUpperCase();
    if (code.length < 3) {
      setScanError('Weka vendor code, mfano V-UDSM-001.');
      return;
    }
    void scanVendor({ code });
  }

  const categories = useMemo(() => {
    if (!menu) return [];
    return ['Zote', ...Array.from(new Set(menu.items.map((item) => item.category)))];
  }, [menu]);

  const visibleItems = useMemo(() => {
    if (!menu) return [];
    if (category === 'Zote') return menu.items;
    return menu.items.filter((item) => item.category === category);
  }, [menu, category]);

  const cartEntries = useMemo(() => {
    if (!menu) return [] as { item: MenuItem; quantity: number }[];
    return Object.entries(cart)
      .map(([id, quantity]) => {
        const item = menu.items.find((entry) => entry.id === id);
        return item ? { item, quantity } : null;
      })
      .filter((entry): entry is { item: MenuItem; quantity: number } => entry !== null);
  }, [cart, menu]);

  const itemCount = cartEntries.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = cartEntries.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);
  const cafeteriaCreditUsed = useCredit
    ? Math.min(subtotal, menu?.student.cafeteriaCreditBalance ?? 0)
    : 0;
  const amountDue = subtotal - cafeteriaCreditUsed;
  const canPay = itemCount > 0 && !submitting;
  function changeQuantity(menuItemId: string, quantity: number) {
    setCart((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[menuItemId];
      else next[menuItemId] = Math.min(10, quantity);
      return next;
    });
    setFormError(null);
    vibrate(12);
  }

  async function submitOrder() {
    if (!menu || !canPay) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const payload: PlaceOrderInput = {
        vendorId: menu.vendor.id,
        useCredit,
        items: cartEntries.map(({ item, quantity }) => ({
          menuItemId: item.id,
          quantity,
        })),
      };
      if (note.trim()) payload.note = note.trim();

      const result = await postJson<PlaceOrderResponse>('/api/student/orders', payload);
      setOrder(result.order);
      setPaymentMessage(result.payment.message);
      if (result.payment.status === 'SETTLED') {
        setPendingOrders((previous) => [
          result.order,
          ...previous.filter((entry) => entry.id !== result.order.id),
        ]);
      } else {
        setPendingPaymentOrders((previous) => [
          result.order,
          ...previous.filter((entry) => entry.id !== result.order.id),
        ]);
      }
      setReviewOpen(false);
      setCart({});
      setNote('');
      setPhase(result.payment.status === 'SETTLED' ? 'coupon' : 'payment');
      if (result.payment.status === 'SETTLED') {
        vibrate([30, 40, 60]);
        toast.success('Malipo yamethibitishwa. Coupon yako iko tayari.', {
          description:
            result.order.creditApplied > 0 && result.order.creditApplied === result.order.total
              ? `Cafeteria credit imetumika kwa ${formatTZS(result.order.creditApplied)}. Hakuna pesa mpya iliyokusanywa.`
              : 'Order ya majaribio imethibitishwa. Hakuna pesa halisi iliyohamishwa.',
        });
      } else {
        toast.info('Test payment imeanzishwa. Kupon itaendelea kiotomatiki.', {
          description: `${menu.vendor.name} • ${formatTZS(result.order.total)}`,
        });
      }
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Malipo hayakufanikiwa. Jaribu tena.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Poll the coupon while it waits for the vendor to verify it.
  const orderId = order?.id ?? null;
  const orderStatus = order?.status ?? null;

  useEffect(() => {
    const waitingForPayment = phase === 'payment' && orderStatus === 'PAYMENT_PENDING';
    const waitingForVendor = phase === 'coupon' && orderStatus === 'PENDING';
    if (!orderId || (!waitingForPayment && !waitingForVendor)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;
      try {
        const data = await apiFetch<StudentOrdersData>(
          `/api/student/orders?id=${encodeURIComponent(orderId)}`,
        );
        if (cancelled) return;
        const next = data.orders[0];
        if (next) {
          setOrder(next);
          if (next.status === 'PAYMENT_FAILED') {
            setPendingPaymentOrders((previous) => previous.filter((entry) => entry.id !== next.id));
            if (testPaymentSecondsRemaining(next.createdAt) === 0) {
              setOrder(null);
              setPhase('scan');
              toast.info('Payment request expired. You can place another order.');
              return;
            }
            setPhase('payment-failed');
            toast.error('Malipo hayakuthibitishwa.', {
              description:
                'Coupon haijatolewa. Hii ilikuwa test payment; hakuna pesa halisi iliyokusanywa.',
            });
            return;
          }
          if (next.status === 'PENDING' && waitingForPayment) {
            setPendingPaymentOrders((previous) => previous.filter((entry) => entry.id !== next.id));
            setPendingOrders((previous) => [
              next,
              ...previous.filter((entry) => entry.id !== next.id),
            ]);
            setPhase('coupon');
            vibrate([30, 40, 60]);
            toast.success('Malipo yamethibitishwa. Coupon yako iko tayari.');
            return;
          }
          if (next.status === 'VERIFIED') {
            setPendingOrders((previous) => previous.filter((entry) => entry.id !== next.id));
            vibrate([40, 40, 90]);
            toast.success('Coupon imethibitishwa!', {
              description: 'Vendor amekagua coupon yako. Chukua chakula chako sasa.',
            });
            return;
          }
          if (next.status === 'CANCELLED') {
            setPendingOrders((previous) => previous.filter((entry) => entry.id !== next.id));
            toast.info('Order hii imeghairiwa.');
            return;
          }
        }
      } catch {
        // Transient network errors: keep polling while the coupon is on screen.
      }
      timer = setTimeout(poll, 1000);
    };

    timer = setTimeout(poll, 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [phase, orderId, orderStatus]);

  if (phase === 'boot') return <PaySkeleton />;

  const demoVendors = campusVendors;

  return (
    <div className="space-y-5">
      {phase === 'scan' ? (
        <>
          <PageHeader
            eyebrow="Meals on campus"
            title="Find your lunch"
            description="Scan a cafeteria QR to see today's menu. Kupon's test gateway automatically simulates payment confirmation."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/student/history">Historia</Link>
              </Button>
            }
          />

          <Alert variant="warning">
            Kupon test gateway: payment stages advance automatically and issue a test coupon.
            Nothing is charged to a phone or collected as real money.
          </Alert>

          {pendingPaymentOrders.map((pendingPayment) => {
            const seconds = testPaymentSecondsRemaining(pendingPayment.createdAt, clockNow);
            return (
              <Alert key={pendingPayment.id} variant="warning" title="Test gateway processing">
                {pendingPayment.vendor.name} · {formatTZS(pendingPayment.total)}. This request
                expires after one minute ({seconds > 0 ? `${seconds}s remaining` : 'expiring'}).
                You can place another order now.
              </Alert>
            );
          })}

          {bootError ? <ErrorState message={bootError} onRetry={() => void loadBoot()} /> : null}

          <PendingOrderDeck
            orders={pendingOrders}
            loading={pendingLoading}
            error={pendingError}
            onRetry={() => void refreshPending()}
            onOpen={openCoupon}
          />

          <Card className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Scan cafeteria QR</p>
              <Badge variant="neutral" dot>
                Counter QR
              </Badge>
            </div>

            <div className="mt-3">
              {scanningBusy ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-14 text-center">
                  <Loader2 className="h-7 w-7 animate-spin text-primary-600" aria-hidden />
                  <p className="mt-3 text-sm font-semibold text-slate-800">Tunapakia menu…</p>
                  <p className="mt-1 max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
                    Tunathibitisha vendor na kuchukua vyakula vinavyopatikana.
                  </p>
                </div>
              ) : scanActive ? (
                <div className="space-y-3">
                  <QrScanner onResult={handleQrResult} active />
                  <Button variant="outline" className="w-full" onClick={() => setScanActive(false)}>
                    Stop camera
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setScanActive(true);
                    setScanError(null);
                  }}
                  className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-primary-200 bg-primary-50/40 px-4 py-10 text-center transition-colors hover:border-primary-300 hover:bg-primary-50"
                >
                  <span className="flex h-16 w-16 animate-soft-float items-center justify-center rounded-2xl bg-white text-primary-600 shadow-card">
                    <ScanLine className="h-8 w-8" aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-slate-800">
                    Fungua kamera • Open camera
                  </span>
                  <span className="max-w-[16rem] text-[11px] leading-relaxed text-slate-500">
                    Elekeza kamera kwenye QR iliyo kwenye counter ya vendor.
                  </span>
                </button>
              )}
            </div>
          </Card>

          {scanError ? (
            <Alert variant="danger" title="Scan haikufanikiwa">
              {scanError}
            </Alert>
          ) : null}

          <Card className="p-4">
            <p className="text-sm font-semibold text-slate-900">Au weka code ya vendor</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Vendor code iko chini ya QR ya counter yao. Unaweza pia kuichagua kutoka vendors
              walio kwenye campus yako hapa chini.
            </p>
            <form onSubmit={submitCode} className="mt-3 flex gap-2">
              <Input
                value={codeInput}
                onChange={(event) => setCodeInput(event.target.value.toUpperCase().slice(0, 30))}
                placeholder="V-UDSM-001"
                className="font-mono uppercase"
                aria-label="Vendor code"
                autoComplete="off"
                spellCheck={false}
              />
              <Button type="submit" loading={scanningBusy} disabled={scanningBusy}>
                Open
              </Button>
            </form>

            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                Cafeterias at {student?.university.name ?? 'your campus'}
              </p>
              {vendorLoadError ? (
                <p className="mt-2 text-xs leading-relaxed text-amber-700" role="status">
                  Orodha ya cafeterias haikupatikana. Tumia QR au code iliyo kwenye counter.
                </p>
              ) : null}
              {!vendorLoadError && campusVendors.length === 0 ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                  Hakuna cafeteria zinazopatikana kwa sasa. Scan QR au code ya counter.
                </p>
              ) : null}
              <div className="mt-2 space-y-2">
                {demoVendors.map((vendor) => (
                  <button
                    key={vendor.code}
                    type="button"
                    onClick={() => void scanVendor({ code: vendor.code })}
                    disabled={scanningBusy}
                    className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:border-primary-200 hover:bg-primary-50/40 disabled:opacity-60"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Store className="h-4 w-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-slate-800">
                        {vendor.name}
                      </span>
                      <span className="block font-mono text-[10px] text-slate-400">
                        {vendor.code}
                      </span>
                    </span>
                    {scanningBusy && busyCode === vendor.code ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary-600" aria-hidden />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </Card>
        </>
      ) : null}

      {phase === 'menu' && menu ? (
        <>
          <PageHeader
            eyebrow={`${menu.vendor.universityName} • ${menu.vendor.code}`}
            title="Chagua chakula"
            description={menu.vendor.description}
            actions={
              <Button variant="outline" size="sm" onClick={resetToScan} disabled={submitting}>
                <ScanLine aria-hidden />
                Badilisha
              </Button>
            }
          />

          <section className="balance-card p-5" aria-label="Cafeteria menu">
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
                  <Store className="h-3.5 w-3.5" aria-hidden />
                  {menu.vendor.code}
                </p>
                <h2 className="mt-1 truncate text-2xl font-semibold tracking-tight">
                  {menu.vendor.name}
                </h2>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-emerald-100/70">
                  {menu.vendor.description}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-emerald-100/70">
                  <MapPin className="h-3.5 w-3.5" aria-hidden />
                  {menu.vendor.universityName}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
                {menu.items.length} items
              </span>
            </div>
            <div className="relative z-10 mt-4 flex items-center justify-between rounded-xl border border-white/15 bg-white/10 px-3 py-2">
              <span className="flex items-center gap-1.5 text-[11px] text-emerald-100/80">
                <Smartphone className="h-3.5 w-3.5" aria-hidden />
                Lipia oda hii kwa simu
              </span>
              <span className="text-[11px] font-semibold text-white">Mobile money</span>
            </div>
          </section>

          {categories.length > 1 ? (
            <div
              className="hide-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1"
              role="group"
              aria-label="Menu categories"
            >
              {categories.map((item) => {
                const sample =
                  item === 'Zote'
                    ? menu.items[0]
                    : menu.items.find((entry) => entry.category === item);
                const selected = category === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setCategory(item)}
                    aria-pressed={selected}
                    className="flex w-[68px] shrink-0 flex-col items-center gap-1.5 text-center"
                  >
                    <span
                      className={cn(
                        'relative h-[58px] w-[58px] overflow-hidden rounded-full border-[3px] p-[2px] transition-all',
                        selected
                          ? 'border-primary-500 shadow-emerald-glow'
                          : 'border-white shadow-sm ring-1 ring-slate-200',
                      )}
                    >
                      <FoodThumb
                        imageUrl={sample?.imageUrl}
                        name={sample?.name ?? item}
                        className="h-full w-full rounded-full"
                      />
                      {selected ? (
                        <span className="absolute inset-0 rounded-full ring-2 ring-white/60" />
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] font-semibold leading-tight',
                        selected ? 'text-primary-800' : 'text-slate-500',
                      )}
                    >
                      {item}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {menu.items.length === 0 ? (
            <EmptyState
              icon={Store}
              title="Hakuna chakula kwa sasa"
              description="Vendor huyu hana vyakula vinavyopatikana kwa sasa. Jaribu vendor mwingine."
              action={
                <Button size="sm" onClick={resetToScan}>
                  <ScanLine aria-hidden />
                  Scan vendor mwingine
                </Button>
              }
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  {category === 'Zote' ? 'Vyakula vyote' : category}
                </h2>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
                  {visibleItems.length} {visibleItems.length === 1 ? 'chakula' : 'vyakula'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3.5 pb-24 sm:grid-cols-2 lg:grid-cols-3 lg:pb-0">
                {visibleItems.map((item, index) => (
                  <FoodProductCard
                    key={item.id}
                    variant="student"
                    item={item}
                    quantity={cart[item.id] ?? 0}
                    maxQuantity={10}
                    onAdd={() => changeQuantity(item.id, (cart[item.id] ?? 0) + 1)}
                    onRemove={() => changeQuantity(item.id, (cart[item.id] ?? 0) - 1)}
                    priority={index < 2}
                    revealIndex={index}
                  />
                ))}
              </div>
            </>
          )}

          {itemCount > 0 ? (
            <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 px-4 lg:static lg:mt-4 lg:px-0">
              <div
                key={itemCount}
                className="mx-auto flex max-w-md animate-order-in items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-lift lg:max-w-none"
              >
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <ShoppingBag className="h-5 w-5" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                    {itemCount}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  </p>
                  <p className="text-sm font-semibold tabular text-slate-900">{formatTZS(subtotal)}</p>
                </div>
                <Button
                  onClick={() => {
                    setReviewOpen(true);
                  }}
                >
                  Review order
                  <ChevronRight aria-hidden />
                </Button>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {phase === 'payment' && order ? (
        <section className="mx-auto w-full max-w-lg space-y-4">
          <PageHeader
            eyebrow="Kupon test gateway"
            title="Payment is processing"
            description="Kupon automatically records the test payment lifecycle. No mobile-money request is sent."
          />
          <Card className="p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                <Smartphone className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">
                  {paymentMessage || 'Kupon is processing this test payment.'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {order.vendor.name} · {formatTZS(order.total)}
                </p>
              </div>
              <Loader2 className="mt-1 h-4 w-4 shrink-0 animate-spin text-primary-600" aria-hidden />
            </div>
            <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              Kupon will record receipt and confirmation automatically. This test does not charge
              or hold real money, and it will not stop you from placing another order.
            </p>
            <ol className="mt-4 space-y-2" aria-label="Test payment progress">
              {PAYMENT_STAGES.map((stage, index) => {
                const currentIndex = PAYMENT_STAGES.findIndex(
                  (entry) => entry.id === order.paymentStage,
                );
                const complete = currentIndex >= index;
                return (
                  <li
                    key={stage.id}
                    className={cn(
                      'flex items-center gap-2 text-xs',
                      complete ? 'font-semibold text-primary-700' : 'text-slate-400',
                    )}
                  >
                    <CheckCircle2
                      className={cn('h-4 w-4', complete ? 'text-emerald-600' : 'text-slate-300')}
                      aria-hidden
                    />
                    {stage.label}
                    {stage.id === order.paymentStage ? (
                      <span className="ml-auto rounded-full bg-primary-50 px-2 py-0.5 text-[10px] uppercase">
                        Current
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-center text-xs font-semibold tabular text-amber-700">
              {testPaymentSecondsRemaining(order.createdAt, clockNow) > 0
                ? `Expires in ${testPaymentSecondsRemaining(order.createdAt, clockNow)} seconds`
                : 'Expiring now'}
            </p>
          </Card>
          <Button type="button" className="w-full" onClick={resetToScan}>
            <ScanLine aria-hidden />
            Continue shopping
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/student/history">View payment history</Link>
          </Button>
        </section>
      ) : null}

      {phase === 'payment-failed' && order ? (
        <section className="mx-auto w-full max-w-lg space-y-4">
          <PageHeader
            eyebrow="Payment not confirmed"
            title="No coupon was issued"
            description="The test gateway did not confirm this payment. No real money was collected and no coupon was issued."
          />
          <Card className="p-5">
            <p className="text-sm font-semibold text-slate-900">{order.vendor.name}</p>
            <p className="mt-1 text-sm tabular text-slate-600">{formatTZS(order.total)}</p>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              The simulated transaction did not reach a confirmed state. The order cannot be collected.
            </p>
          </Card>
          <Button onClick={resetToScan} className="w-full">
            <ScanLine aria-hidden />
            Choose a meal again
          </Button>
        </section>
      ) : null}

      {phase === 'coupon' && order ? (
        <>
          <PageHeader
            eyebrow={order.paymentTest ? 'TEST COUPON • Order' : 'Coupon • Order'}
            title="Coupon yako"
            description="Onyesha coupon hii kwa vendor. Status inasasishwa yenyewe mara vendor anapoi-verify."
          />
          {order.paymentTest ? (
            <Alert variant="warning">
              Test payment automatically confirmed by Kupon&apos;s gateway. No real money was
              collected.
            </Alert>
          ) : null}
          <FoodCoupon order={order} onNewOrder={resetToScan} />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button asChild variant="outline">
              <Link href="/student">Back home</Link>
            </Button>
            <Button onClick={resetToScan}>
              <ScanLine aria-hidden />
              Scan another vendor
            </Button>
          </div>
          <p className="flex items-center justify-center gap-2 pb-2 text-center text-[11px] text-slate-400">
            {order.status === 'PENDING' ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Inasubiri vendor aweke verified…
              </>
            ) : order.status === 'VERIFIED' ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                Coupon imekamilika. Chukua chakula chako.
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-slate-400" aria-hidden />
                Order hii imeghairiwa.
              </>
            )}
          </p>
        </>
      ) : null}

      <Dialog
        open={reviewOpen}
        onOpenChange={(value) => {
          if (!submitting) setReviewOpen(value);
        }}
      >
        <DialogContent>
          {submitting ? (
            <PayingPanel />
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Review order</DialogTitle>
                <DialogDescription>
                  {menu?.vendor.name}
                  {menu ? ` • ${menu.vendor.code}` : ''} • {itemCount}{' '}
                  {itemCount === 1 ? 'item' : 'items'}
                </DialogDescription>
              </DialogHeader>

              <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                {cartEntries.map(({ item, quantity }) => (
                  <div key={item.id} className="flex items-center gap-2.5">
                    <FoodThumb
                      imageUrl={item.imageUrl}
                      name={item.name}
                      className="h-9 w-9 rounded-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatTZS(item.price)} × {quantity}
                      </p>
                    </div>
                    <span className="tabular text-xs font-semibold text-slate-700">
                      {formatTZS(item.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Jumla</span>
                  <span className="font-semibold tabular text-slate-900">{formatTZS(subtotal)}</span>
                </div>
                {menu && menu.student.cafeteriaCreditBalance > 0 ? (
                  <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-primary-100 bg-white p-3">
                    <input
                      type="checkbox"
                      checked={useCredit}
                      onChange={(event) => setUseCredit(event.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="flex-1">
                      <span className="block font-semibold text-slate-800">
                        Use {menu.vendor.name} credit
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-slate-500">
                        Up to {formatTZS(menu.student.cafeteriaCreditBalance)}. Credit is limited to
                        this cafeteria.
                      </span>
                    </span>
                  </label>
                ) : null}
                {cafeteriaCreditUsed > 0 ? (
                  <div className="flex justify-between gap-3 text-emerald-700">
                    <span>Cafeteria credit</span>
                    <span className="font-semibold tabular">− {formatTZS(cafeteriaCreditUsed)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between gap-3 border-t border-slate-200 pt-1.5">
                  <span className="text-slate-500">
                    {amountDue > 0 ? 'Remaining test payment' : 'Due'}
                  </span>
                  <span className="font-semibold tabular text-slate-900">{formatTZS(amountDue)}</span>
                </div>
              </div>

              <Alert variant="warning">
                Kupon test gateway only. It simulates payment receipt and confirmation, then issues
                the coupon automatically. No mobile-money request is sent and no real money is held
                or collected.
              </Alert>

              <div className="space-y-1.5">
                <Label htmlFor="order-note">Note kwa vendor (hiari)</Label>
                <Textarea
                  id="order-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value.slice(0, 160))}
                  placeholder="Mfano: Bila pilipili, chapati moja ya ziada…"
                  className="min-h-[72px]"
                />
                <p className="text-right text-[10px] tabular text-slate-400">{note.length}/160</p>
              </div>

              {formError ? (
                <Alert variant="danger" title="Malipo hayakufanikiwa">
                  {formError}
                </Alert>
              ) : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={submitting}>
                  Ghairi
                </Button>
                <Button onClick={() => void submitOrder()} loading={submitting} disabled={!canPay}>
                  <Smartphone aria-hidden />
                  {amountDue > 0 ? `Continue · ${formatTZS(amountDue)} test` : 'Use cafeteria credit'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
}
