'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  ChevronLeft,
  Loader2,
  LockKeyhole,
  Phone,
  PlusCircle,
  Smartphone,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import {
  MAX_TOPUP,
  MIN_TOPUP,
  MOBILE_NETWORKS,
  NETWORK_LABEL,
  TOPUP_AMOUNTS,
  type MobileNetwork,
} from '@/lib/constants';
import {
  cn,
  formatDateTime,
  formatTZS,
  isValidTzPhone,
  maskPhone,
} from '@/lib/utils';
import type { TopUpCreated, TopUpStatusData, WalletData } from '../_lib/types';

type Step = 'form' | 'confirm' | 'pending' | 'success' | 'failed';

const STEP_LABELS = ['Kiasi', 'Thibitisha', 'Maliza'] as const;

function SummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-xs">
      <span className="shrink-0 text-slate-500">{label}</span>
      <span
        className={cn(
          'min-w-0 truncate text-right font-semibold text-slate-800 tabular',
          mono && 'font-mono text-[11px] tracking-tight',
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function TopUpPage() {
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [whopEnabled, setWhopEnabled] = useState(false);
  const [azamPayEnabled, setAzamPayEnabled] = useState(false);
  const [azamPayEnvironment, setAzamPayEnvironment] = useState<'sandbox' | 'production' | null>(
    null,
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [network, setNetwork] = useState<MobileNetwork>('M-PESA');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [touched, setTouched] = useState(false);

  const [step, setStep] = useState<Step>('form');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [created, setCreated] = useState<TopUpCreated | null>(null);
  const [result, setResult] = useState<TopUpStatusData | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const [pollKey, setPollKey] = useState(0);

  const loadWallet = useCallback(async () => {
    try {
      const data = await apiFetch<WalletData>('/api/student/wallet');
      setWallet(data);
      setPhone((current) => current || data.student.phone);
    } catch {
      // The form still works; the balance chip simply stays empty.
    }
  }, []);

  useEffect(() => {
    void loadWallet();
    apiFetch<{
      whopEnabled: boolean;
      azampayEnabled: boolean;
      azampayEnvironment: 'sandbox' | 'production' | null;
    }>('/api/student/topup/config')
      .then((config) => {
        setWhopEnabled(config.whopEnabled);
        setAzamPayEnabled(config.azampayEnabled);
        setAzamPayEnvironment(config.azampayEnvironment);
      })
      .catch(() => {
        setWhopEnabled(false);
        setAzamPayEnabled(false);
        setAzamPayEnvironment(null);
      });
  }, [loadWallet]);

  // Returning from the hosted Whop checkout: resume the pending transaction and
  // let the verified webhook settle it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('whop') !== 'return') return;
    const tx = params.get('tx');
    if (!tx) return;
    const returnAmount = Number(params.get('amount'));
    if (Number.isInteger(returnAmount) && returnAmount > 0) setAmount(returnAmount);
    setWhopEnabled(true);
    setCreated({
      transactionId: tx,
      reference: params.get('ref') ?? '',
      status: 'PENDING',
      routeCode: '',
      message: 'Tunathibitisha malipo yako ya Whop…',
      aggregatorFee: 0,
      provider: 'whop',
    });
    setStep('pending');
  }, []);

  // AzamPay is the primary Tanzanian mobile-money rail. Whop is only a fallback
  // for environments where AzamPay is not configured.
  const useAzamPay = azamPayEnabled;
  const useWhop = !azamPayEnabled && whopEnabled;
  const directProvider = useAzamPay || useWhop;
  const effectiveAmount = customAmount.length > 0 ? Number(customAmount) : amount;

  const amountError = (() => {
    if (!effectiveAmount || Number.isNaN(effectiveAmount)) {
      return 'Chagua au weka kiasi cha kuweka.';
    }
    if (!Number.isInteger(effectiveAmount)) return 'Kiasi lazima kiwe namba kamili.';
    if (effectiveAmount < MIN_TOPUP) return `Kiwango cha chini ni ${formatTZS(MIN_TOPUP)}.`;
    if (effectiveAmount > MAX_TOPUP) return `Kiwango cha juu ni ${formatTZS(MAX_TOPUP)}.`;
    return null;
  })();

  const phoneError =
    phone.trim().length === 0
      ? 'Weka namba ya simu.'
      : !isValidTzPhone(phone)
        ? 'Namba si sahihi. Mfano: +255 712 345 678.'
        : null;

  const canContinue = !amountError && !phoneError;

  function chooseAmount(value: number) {
    setAmount(value);
    setCustomAmount('');
    setFormError(null);
  }

  function handleCustomAmount(raw: string) {
    setCustomAmount(raw.replace(/[^\d]/g, '').slice(0, 6));
    setAmount(null);
    setFormError(null);
  }

  function goConfirm() {
    setTouched(true);
    if (!canContinue) {
      setFormError(amountError ?? phoneError);
      return;
    }
    setFormError(null);
    setPin('');
    setStep('confirm');
  }

  async function submitTopUp() {
    if (!effectiveAmount) return;
    setSubmitting(true);
    setFormError(null);
    setFailure(null);
    try {
      const response = await postJson<TopUpCreated>('/api/student/topup', {
        amount: effectiveAmount,
        network,
        phone,
      });
      setCreated(response);
      setSlow(false);
      if (response.checkoutUrl) {
        toast.success('Unaelekezwa kwenye Whop', { description: response.message });
        window.location.assign(response.checkoutUrl);
        return;
      }
      setStep('pending');
      toast.success('Ombi la kuweka pesa limetumwa', { description: response.message });
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : 'Top-up imeshindikana. Jaribu tena.';
      setFormError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  // Poll while the aggregator confirmation is in flight.
  useEffect(() => {
    if (step !== 'pending' || !created) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const status = await apiFetch<TopUpStatusData>(
          `/api/student/topup?id=${encodeURIComponent(created.transactionId)}`,
        );
        if (cancelled) return;

        if (status.transaction.status === 'SETTLED') {
          setResult(status);
          setStep('success');
          toast.success('Pesa imeingia kwenye wallet yako', {
            description: `Salio jipya: ${formatTZS(status.balance)}`,
          });
          router.refresh();
          void loadWallet();
          return;
        }

        if (status.transaction.status === 'FAILED') {
          setFailure('Malipo hayakufanikiwa. Hakuna pesa iliyokatwa kwenye wallet yako.');
          setStep('failed');
          return;
        }
      } catch (err) {
        if (cancelled) return;
        if (attempts >= 5) {
          setFailure(
            err instanceof ApiClientError
              ? err.message
              : 'Imeshindikana kuangalia hali ya malipo.',
          );
          setStep('failed');
          return;
        }
      }

      if (attempts >= 30) {
        if (!cancelled) setSlow(true);
        return;
      }
      timer = setTimeout(poll, 1800);
    };

    timer = setTimeout(poll, 1200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [step, created, pollKey, router, loadWallet]);

  function checkAgain() {
    setSlow(false);
    setPollKey((key) => key + 1);
  }

  function resetFlow() {
    setStep('form');
    setCreated(null);
    setResult(null);
    setFailure(null);
    setSlow(false);
    setFormError(null);
    setPin('');
    setTouched(false);
  }

  const stepIndex = step === 'form' ? 0 : step === 'confirm' ? 1 : 2;

  return (
    <div className="space-y-5">
      <PageHeader
        backHref="/student"
        eyebrow="Top up • Weka pesa"
        title="Weka pesa kwenye wallet"
        description="Ongeza salio kwa M-Pesa, Tigo Pesa, Airtel Money au Halotel. Pesa inaingia mara moja baada ya uthibitisho."
      />

      <ol className="flex items-center gap-1.5" aria-label="Hatua za kuweka pesa">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className="flex flex-1 items-center gap-1.5">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                index <= stepIndex ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-400',
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                'truncate text-[10px] font-semibold',
                index <= stepIndex ? 'text-slate-700' : 'text-slate-400',
              )}
            >
              {label}
            </span>
            {index < STEP_LABELS.length - 1 ? (
              <span
                className={cn(
                  'h-px flex-1 rounded',
                  index < stepIndex ? 'bg-primary-300' : 'bg-slate-200',
                )}
                aria-hidden
              />
            ) : null}
          </li>
        ))}
      </ol>

      {step === 'form' || step === 'confirm' ? (
        <Card className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-500">
                Salio la sasa
              </p>
              <p className="truncate text-sm font-semibold tabular text-slate-900">
                {wallet ? formatTZS(wallet.balance) : 'Inapakia…'}
              </p>
            </div>
          </div>
          {wallet ? <Badge variant="neutral">{wallet.student.university.code}</Badge> : null}
        </Card>
      ) : null}

      {step === 'form' ? (
        <Card className="p-5">
          <div className="space-y-5">
            <div className="space-y-2.5">
              <Label>Kiasi cha kuweka</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {TOPUP_AMOUNTS.map((value) => {
                  const selected = amount === value && customAmount.length === 0;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseAmount(value)}
                      aria-pressed={selected}
                      className={cn(
                        'h-11 rounded-lg border text-sm font-semibold tabular transition-all',
                        selected
                          ? 'border-primary-500 bg-primary-50 text-primary-800 ring-2 ring-primary-500/20'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                      )}
                    >
                      {formatTZS(value)}
                    </button>
                  );
                })}
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  TZS
                </span>
                <Input
                  inputMode="numeric"
                  placeholder="Weka kiasi kingine"
                  value={customAmount}
                  onChange={(event) => handleCustomAmount(event.target.value)}
                  className="pl-11 tabular"
                  aria-label="Kiasi kingine cha kuweka"
                  error={touched && amountError && customAmount.length > 0 ? true : undefined}
                />
              </div>
              {touched && amountError ? (
                <p className="text-[11px] font-medium text-red-600">{amountError}</p>
              ) : effectiveAmount && !amountError ? (
                <p className="text-[11px] text-slate-500">
                  Utaweka <span className="font-semibold text-slate-700">{formatTZS(effectiveAmount)}</span>
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Kiwango: {formatTZS(MIN_TOPUP)} – {formatTZS(MAX_TOPUP)}.
                </p>
              )}
            </div>

            <div className="space-y-2.5">
              <Label>Mtandao</Label>
              <div className="grid grid-cols-2 gap-2">
                {MOBILE_NETWORKS.map((option) => {
                  const selected = network === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setNetwork(option.id)}
                      aria-pressed={selected}
                      className={cn(
                        'flex items-center gap-2.5 rounded-xl border p-3 text-left transition-all',
                        selected
                          ? 'border-primary-500 bg-primary-50/60 ring-2 ring-primary-500/20'
                          : 'border-slate-200 bg-white hover:border-slate-300',
                      )}
                    >
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
                        style={{ backgroundColor: option.color }}
                        aria-hidden
                      >
                        {option.short.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold text-slate-800">
                          {option.name}
                        </span>
                        <span className="block truncate text-[10px] text-slate-400">
                          {option.short}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="topup-phone">Namba ya simu</Label>
              <div className="relative">
                <Phone
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id="topup-phone"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+255 712 345 678"
                  className="pl-10 tabular"
                  error={touched && phoneError ? true : undefined}
                />
              </div>
              {touched && phoneError ? (
                <p className="text-[11px] font-medium text-red-600">{phoneError}</p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Tutatuma push ya {NETWORK_LABEL[network]} kwenye namba hii.
                </p>
              )}
            </div>

            <Alert variant="info">
              Hakuna ada ya ziada kwako. Kiasi unachoweka ndicho kinachofika kwenye wallet.
            </Alert>

            {formError ? (
              <Alert variant="danger" title="Angalia taarifa zako">
                {formError}
              </Alert>
            ) : null}

            <Button className="w-full" size="lg" onClick={goConfirm}>
              <PlusCircle aria-hidden />
              Endelea kuweka pesa
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'confirm' ? (
        <Card className="p-5">
          <button
            type="button"
            onClick={() => {
              setStep('form');
              setFormError(null);
            }}
            className="inline-flex min-h-[32px] items-center gap-1 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Badilisha
          </button>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <SummaryRow label="Kiasi" value={formatTZS(effectiveAmount ?? 0)} />
            <SummaryRow
              label="Njia"
              value={useAzamPay ? 'AzamPay mobile money' : useWhop ? 'Whop checkout' : NETWORK_LABEL[network]}
            />
            <SummaryRow label="Namba" value={phone} mono />
          </div>

          {directProvider ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs leading-relaxed text-emerald-900">
              <p className="font-semibold">
                {useAzamPay
                  ? azamPayEnvironment === 'sandbox'
                    ? 'AzamPay sandbox imepokea ombi lako.'
                    : 'AzamPay itatuma ombi la uthibitisho kwenye simu yako.'
                  : 'Utalipia kwenye ukurasa salama wa Whop.'}
              </p>
              <p className="mt-1 text-emerald-800/80">
                {useAzamPay
                  ? azamPayEnvironment === 'sandbox'
                    ? 'Sandbox ni mazingira ya majaribio; USSD inaweza isifike kwenye laini halisi. Jaribu kutumia namba ya majaribio ya AzamPay, na usitume ombi jingine kama hili bado linasubiri.'
                    : `Thibitisha malipo kwa PIN ya ${NETWORK_LABEL[network]}. Wallet yako itaongezwa baada ya AzamPay kuthibitisha.`
                  : 'Wallet yako itaongezwa mara tu Whop itakapothibitisha malipo. Hakuna PIN ya mtandao inayohitajika hapa.'}
              </p>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              <Label htmlFor="demo-pin">PIN ya uthibitisho (demo)</Label>
              <div className="relative">
                <LockKeyhole
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden
                />
                <Input
                  id="demo-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(event) =>
                    setPin(event.target.value.replace(/[^\d]/g, '').slice(0, 4))
                  }
                  placeholder="••••"
                  className="pl-10 tracking-[0.5em]"
                  autoComplete="one-time-code"
                />
              </div>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Hii ni demo: weka tarakimu yoyote 4 kuthibitisha. Kwenye production utathibitisha
                kwa PIN ya mtandao kwenye simu yako.
              </p>
            </div>
          )}

          {formError ? (
            <Alert variant="danger" title="Top-up imeshindikana" className="mt-4">
              {formError}
            </Alert>
          ) : null}

          <Button
            className="mt-4 w-full"
            size="lg"
            loading={submitting}
            disabled={(!directProvider && pin.length !== 4) || submitting}
            onClick={() => void submitTopUp()}
          >
            {useAzamPay ? 'Tuma USSD push' : useWhop ? 'Lipa kwa Whop' : 'Thibitisha'} •{' '}
            {formatTZS(effectiveAmount ?? 0)}
          </Button>
        </Card>
      ) : null}

      {step === 'pending' && created ? (
        <Card className="p-6 text-center">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary-200/50" aria-hidden />
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary-50 text-primary-600">
              <Smartphone className="h-7 w-7" aria-hidden />
            </span>
          </div>
          <p className="mt-4 text-base font-semibold text-slate-900">Tunasubiri uthibitisho</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
            {created.message}
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <SummaryRow label="Kiasi" value={formatTZS(effectiveAmount ?? 0)} />
            <SummaryRow label="Mtandao" value={NETWORK_LABEL[network]} />
            <SummaryRow label="Namba" value={maskPhone(phone)} mono />
            <SummaryRow label="Kumbukumbu" value={created.reference} mono />
            <SummaryRow label="Lipa Namba" value={created.routeCode} mono />
          </div>

          {slow ? (
            <div className="mt-4 space-y-3">
              <Alert variant="warning" title="Uthibitisho umechelewa">
                Bado hatujapata uthibitisho. Usiweke tena — unaweza kuangalia hali bila kuweka
                ombi jipya.
              </Alert>
              <Button variant="outline" className="w-full" onClick={checkAgain}>
                Angalia hali tena
              </Button>
            </div>
          ) : (
            <p className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              Tunathibitisha malipo…
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Unaweza kuondoka ukurasa huu — malipo yatakamilika nyuma na salio litaonekana.
          </p>
        </Card>
      ) : null}

      {step === 'success' && result ? (
        <Card className="animate-scale-in p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold text-slate-900">Pesa imeingia!</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight tabular text-slate-900">
            {formatTZS(result.transaction.amount)}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Salio jipya:{' '}
            <span className="font-semibold tabular text-emerald-700">
              {formatTZS(result.balance)}
            </span>
          </p>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
            <SummaryRow label="Kumbukumbu" value={result.transaction.reference} mono />
            <SummaryRow
              label="Muda"
              value={formatDateTime(
                result.transaction.settledAt ?? result.transaction.createdAt,
              )}
            />
            <SummaryRow label="Lipa Namba" value={created?.routeCode ?? '—'} mono />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={resetFlow}>
              <PlusCircle aria-hidden />
              Weka tena
            </Button>
            <Button asChild>
              <Link href="/student">Rudi nyumbani</Link>
            </Button>
          </div>
        </Card>
      ) : null}

      {step === 'failed' ? (
        <Card className="p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-red-600">
            <XCircle className="h-8 w-8" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold text-slate-900">Top-up haijakamilika</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-slate-500">
            {failure ?? 'Malipo hayakufanikiwa. Hakuna pesa iliyokatwa.'}
          </p>
          <p className="mx-auto mt-2 max-w-xs text-[11px] leading-relaxed text-slate-400">
            Kama uliona ujumbe wa kukatwa kwenye simu yako, angalia historia kabla ya kujaribu
            tena — malipo yanaweza kuwa yamekamilika.
          </p>
          {created ? (
            <p className="mt-3 text-[11px] text-slate-400">Kumbukumbu: {created.reference}</p>
          ) : null}
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button variant="outline" onClick={resetFlow}>
              Jaribu tena
            </Button>
            <Button asChild>
              <Link href="/student">Rudi nyumbani</Link>
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
