'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  BatteryFull,
  MessageSquare,
  PhoneCall,
  PhoneOff,
  Signal,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ApiClientError, postJson } from '@/lib/client-api';
import { MOBILE_NETWORKS } from '@/lib/constants';
import { cn, formatTZS, isValidTzPhone, maskPhone, normalizePhone } from '@/lib/utils';

type Step =
  | 'phone'
  | 'menu'
  | 'balance'
  | 'pay-vendor'
  | 'pay-amount'
  | 'pay-pin'
  | 'pay-confirm'
  | 'pay-result'
  | 'topup-network'
  | 'topup-amount'
  | 'topup-result'
  | 'error'
  | 'exit';

type SmsKind = 'success' | 'pending' | 'failure';

type SmsEntry = {
  id: string;
  message: string;
  at: string;
  to: string;
  kind: SmsKind;
};

type BalanceData = {
  studentName: string;
  studentNumber: string;
  balance: number;
  university: { id: string; name: string; code: string; city: string };
  sms: string[];
};

type PayData = {
  studentName: string;
  vendorName: string;
  vendorCode: string;
  amount: number;
  balance: number;
  reference: string;
  transactionId: string;
  sms: string[];
};

type TopUpData = {
  amount: number;
  network: string;
  networkLabel: string;
  reference: string;
  status: string;
  message: string;
  routeCode: string;
  balance: number;
  sms: string[];
};

const NETWORKS = MOBILE_NETWORKS.map((network, index) => ({
  key: String(index + 1),
  id: network.id as string,
  label: network.name,
}));

const KEYPAD = [
  { key: '1', letters: '' },
  { key: '2', letters: 'ABC' },
  { key: '3', letters: 'DEF' },
  { key: '4', letters: 'GHI' },
  { key: '5', letters: 'JKL' },
  { key: '6', letters: 'MNO' },
  { key: '7', letters: 'PQRS' },
  { key: '8', letters: 'TUV' },
  { key: '9', letters: 'WXYZ' },
  { key: '*', letters: '' },
  { key: '0', letters: '+' },
  { key: '#', letters: '' },
];

const MAX_LENGTH: Partial<Record<Step, number>> = {
  phone: 12,
  'pay-vendor': 16,
  'pay-amount': 6,
  'pay-pin': 4,
};

function smsFromError(error: unknown): string[] | null {
  if (!(error instanceof ApiClientError)) return null;
  const details = error.details;
  if (!details || typeof details !== 'object' || !('sms' in details)) return null;
  const value = (details as { sms?: unknown }).sms;
  if (!Array.isArray(value)) return null;
  const lines = value.filter((line): line is string => typeof line === 'string');
  return lines.length > 0 ? lines : null;
}

function ScreenInput({ value, masked }: { value: string; masked?: boolean }) {
  return (
    <div className="mt-2 flex min-h-[34px] items-center gap-1.5 rounded border border-primary-500/30 bg-primary-500/[0.07] px-2 py-1.5">
      <span className="text-primary-500/70">&gt;</span>
      <span className="tracking-[0.18em]">
        {masked ? '•'.repeat(value.length) : value}
      </span>
      <span className="motion-safe:animate-pulse" aria-hidden>
        _
      </span>
    </div>
  );
}

/**
 * Feature phone USSD simulator. The browser posts to the public /api/ussd demo
 * route; in production the telco gateway would drive this session with a
 * trusted MSISDN, so this page could not exist.
 */
export function UssdSimulator({
  demoPhone,
  shortCode,
  vendors,
}: {
  demoPhone: string;
  shortCode: string;
  vendors: { code: string; name: string }[];
}) {
  const demoVendor = vendors[0];
  const demoVendorSuffix = demoVendor?.code.split('-').at(-1) ?? '001';
  const [step, setStep] = useState<Step>('phone');
  const [input, setInput] = useState('');
  const [phone, setPhone] = useState('');
  const [vendor, setVendor] = useState('');
  const [amount, setAmount] = useState('');
  const [pin, setPin] = useState('');
  const [network, setNetwork] = useState<{ key: string; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [balanceResult, setBalanceResult] = useState<BalanceData | null>(null);
  const [payResult, setPayResult] = useState<PayData | null>(null);
  const [topupResult, setTopupResult] = useState<TopUpData | null>(null);
  const [failure, setFailure] = useState<{ message: string; retryStep: Step } | null>(null);
  const [smsLog, setSmsLog] = useState<SmsEntry[]>([]);

  const smsEndRef = useRef<HTMLDivElement | null>(null);
  const keyHandlerRef = useRef<(event: globalThis.KeyboardEvent) => void>(() => {});
  // Synchronous guard: React state updates are async, so two rapid taps could
  // otherwise fire two charge requests before `busy` renders.
  const inFlightRef = useRef(false);

  useEffect(() => {
    smsEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [smsLog.length]);

  const normalizedPhone = phone || normalizePhone(input);

  function pushSms(messages: string[], kind: SmsKind) {
    if (messages.length === 0) return;
    const at = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const to = normalizedPhone || '+255712345678';
    const stamp = Date.now();
    setSmsLog((current) => [
      ...current,
      ...messages.map((message, index) => ({
        id: `${stamp}-${index}-${Math.random().toString(36).slice(2, 6)}`,
        message,
        at,
        to,
        kind,
      })),
    ]);
  }

  function resetDraft() {
    setVendor('');
    setAmount('');
    setPin('');
    setNetwork(null);
    setInput('');
    setNote(null);
    setFailure(null);
    setBalanceResult(null);
    setPayResult(null);
    setTopupResult(null);
  }

  function resetSession() {
    resetDraft();
    setPhone('');
    setStep('phone');
  }

  function resetEverything() {
    resetSession();
    setSmsLog([]);
    toast.success('Simulation reset', { description: 'The SMS inbox and handset state are clear.' });
  }

  function beginRequest(): boolean {
    if (inFlightRef.current) return false;
    inFlightRef.current = true;
    setBusy(true);
    return true;
  }

  function endRequest() {
    inFlightRef.current = false;
    setBusy(false);
  }

  async function fetchBalance() {
    if (!beginRequest()) return;
    setStep('balance');
    setNote(null);
    setBalanceResult(null);
    try {
      const data = await postJson<BalanceData>('/api/ussd', {
        action: 'balance',
        phone: normalizedPhone,
      });
      setBalanceResult(data);
      pushSms(data.sms, 'success');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Salio halikuweza kupatikana. Jaribu tena.';
      pushSms(smsFromError(error) ?? [`KUPON: ${message}`], 'failure');
      setFailure({ message, retryStep: 'balance' });
      setStep('error');
    } finally {
      endRequest();
    }
  }

  async function submitPayment() {
    if (!beginRequest()) return;
    try {
      const data = await postJson<PayData>('/api/ussd', {
        action: 'pay',
        phone: normalizedPhone,
        vendorCode: vendor,
        amount: Number(amount),
        pin,
      });
      setPayResult(data);
      pushSms(data.sms, 'success');
      setPin('');
      setInput('');
      setStep('pay-result');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Malipo hayakukamilika. Jaribu tena.';
      pushSms(smsFromError(error) ?? [`KUPON: ${message}`], 'failure');
      setFailure({ message, retryStep: 'pay-pin' });
      setPin('');
      setInput('');
      setStep('error');
    } finally {
      endRequest();
    }
  }

  async function submitTopUp(chosenNetwork: { id: string; label: string }, value: number) {
    if (!beginRequest()) return;
    try {
      const data = await postJson<TopUpData>('/api/ussd', {
        action: 'topup',
        phone: normalizedPhone,
        amount: value,
        network: chosenNetwork.id,
      });
      setTopupResult(data);
      pushSms(data.sms, 'pending');
      setInput('');
      setStep('topup-result');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Ombi halikupokelewa. Jaribu tena.';
      pushSms(smsFromError(error) ?? [`KUPON: ${message}`], 'failure');
      setFailure({ message, retryStep: 'topup-amount' });
      setInput('');
      setStep('error');
    } finally {
      endRequest();
    }
  }

  function retryFailure() {
    const retryStep = failure?.retryStep ?? 'menu';
    setFailure(null);
    setNote(null);
    setInput('');
    if (retryStep === 'balance') {
      void fetchBalance();
      return;
    }
    setStep(retryStep);
  }

  function chooseMenu(key: string) {
    setInput('');
    setNote(null);
    if (key === '1') {
      void fetchBalance();
      return;
    }
    if (key === '2') {
      resetDraft();
      setStep('pay-vendor');
      return;
    }
    if (key === '3') {
      resetDraft();
      setStep('topup-network');
      return;
    }
    if (key === '4') {
      setStep('exit');
      return;
    }
    setNote('Chagua 1 hadi 4.');
  }

  function chooseNetwork(key: string) {
    const found = NETWORKS.find((item) => item.key === key);
    if (!found) {
      setNote('Chagua mtandao 1 hadi 4.');
      return;
    }
    setNetwork(found);
    setInput('');
    setNote(null);
    setStep('topup-amount');
  }

  function handleBackspace() {
    if (busy) return;
    setNote(null);
    if (['phone', 'pay-vendor', 'pay-amount', 'pay-pin'].includes(step)) {
      setInput((current) => current.slice(0, -1));
    }
  }

  function pressChar(char: string) {
    if (busy) return;
    setNote(null);
    switch (step) {
      case 'phone':
      case 'pay-amount':
      case 'pay-pin':
        if (/^\d$/.test(char)) {
          const max = MAX_LENGTH[step] ?? 12;
          setInput((current) => (current.length < max ? current + char : current));
        }
        return;
      case 'pay-vendor':
        if (/^[0-9a-zA-Z-]$/.test(char)) {
          setInput((current) =>
            current.length < (MAX_LENGTH['pay-vendor'] ?? 16)
              ? (current + char).toUpperCase()
              : current,
          );
        }
        return;
      case 'menu':
        chooseMenu(char);
        return;
      case 'topup-network':
        chooseNetwork(char);
        return;
      case 'pay-confirm':
        if (char === '1') {
          void submitPayment();
        } else if (char === '2') {
          setPin('');
          setStep('pay-pin');
        } else {
          setNote('Bonyeza 1 kuthibitisha au 2 kughairi.');
        }
        return;
      case 'balance':
        if (char === '1') {
          setStep('menu');
          setBalanceResult(null);
        } else if (char === '2') {
          setStep('exit');
        } else {
          setNote('Bonyeza 1 kwa menyu au 2 kutoka.');
        }
        return;
      case 'pay-result':
      case 'topup-result':
        if (char === '1') {
          resetDraft();
          setStep('menu');
        } else if (char === '2') {
          setStep('exit');
        } else {
          setNote('Bonyeza 1 kwa menyu au 2 kutoka.');
        }
        return;
      case 'error':
        if (char === '1') {
          retryFailure();
        } else if (char === '2') {
          setFailure(null);
          setStep('menu');
        } else {
          setNote('Bonyeza 1 kujaribu tena au 2 kurudi.');
        }
        return;
      case 'exit':
        if (char === '1') {
          resetSession();
        } else {
          setNote('Bonyeza 1 kuanza tena.');
        }
        return;
    }
  }

  function pressKey(key: string) {
    if (busy) return;
    if (key === '*') {
      setInput('');
      setNote(null);
      return;
    }
    if (key === '#') {
      void primaryAction();
      return;
    }
    pressChar(key);
  }

  async function primaryAction() {
    if (busy) return;
    setNote(null);
    switch (step) {
      case 'phone': {
        const candidate = normalizePhone(input);
        if (!isValidTzPhone(candidate)) {
          setNote(`Weka namba sahihi, mfano ${demoPhone || 'namba ya mwanafunzi'}.`);
          return;
        }
        setPhone(candidate);
        setInput('');
        setStep('menu');
        return;
      }
      case 'menu':
        if (!input) {
          setNote('Chagua 1 hadi 4 kisha bonyeza Chagua.');
          return;
        }
        chooseMenu(input);
        return;
      case 'balance':
        setBalanceResult(null);
        setStep('menu');
        return;
      case 'pay-vendor': {
        const value = input.trim().toUpperCase();
        if (!/^(\d{1,3}|V-[A-Z]{2,8}-\d{3})$/.test(value)) {
          setNote(`Weka namba ya vendor, mfano ${demoVendorSuffix}.`);
          return;
        }
        setVendor(value);
        setInput('');
        setStep('pay-amount');
        return;
      }
      case 'pay-amount': {
        const value = Number(input);
        if (!Number.isInteger(value) || value < 500 || value > 100_000) {
          setNote('Kiasi ni kati ya TZS 500 na 100,000.');
          return;
        }
        setAmount(String(value));
        setInput('');
        setStep('pay-pin');
        return;
      }
      case 'pay-pin':
        if (!/^\d{4}$/.test(input)) {
          setNote('PIN ni tarakimu nne.');
          return;
        }
        setPin(input);
        setInput('');
        setStep('pay-confirm');
        return;
      case 'pay-confirm':
        await submitPayment();
        return;
      case 'pay-result':
        resetDraft();
        setStep('menu');
        return;
      case 'topup-network':
        if (!input) {
          setNote('Chagua mtandao 1 hadi 4.');
          return;
        }
        chooseNetwork(input);
        return;
      case 'topup-amount': {
        const value = Number(input);
        if (!Number.isInteger(value) || value < 500 || value > 500_000) {
          setNote('Kiasi ni kati ya TZS 500 na 500,000.');
          return;
        }
        if (!network) {
          setStep('topup-network');
          return;
        }
        setAmount(String(value));
        setInput('');
        await submitTopUp(network, value);
        return;
      }
      case 'topup-result':
        resetDraft();
        setStep('menu');
        return;
      case 'error':
        retryFailure();
        return;
      case 'exit':
        resetSession();
        return;
    }
  }

  function backAction() {
    if (busy) return;
    setNote(null);
    setInput('');
    switch (step) {
      case 'phone':
        setInput('');
        return;
      case 'menu':
        setStep('exit');
        return;
      case 'balance':
        setBalanceResult(null);
        setStep('menu');
        return;
      case 'pay-vendor':
        setStep('menu');
        return;
      case 'pay-amount':
        setStep('pay-vendor');
        return;
      case 'pay-pin':
        setStep('pay-amount');
        return;
      case 'pay-confirm':
        setStep('pay-pin');
        return;
      case 'pay-result':
        resetDraft();
        setStep('menu');
        return;
      case 'topup-network':
        setStep('menu');
        return;
      case 'topup-amount':
        setStep('topup-network');
        return;
      case 'topup-result':
        resetDraft();
        setStep('menu');
        return;
      case 'error':
        setFailure(null);
        setStep('menu');
        return;
      case 'exit':
        resetSession();
        return;
    }
  }

  useEffect(() => {
    keyHandlerRef.current = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      if (/^[0-9*#]$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key);
        return;
      }
      if (event.key === 'Enter') {
        // Let a focused button or link activate natively instead of hijacking it.
        if (target?.closest('button, a, [role="button"]')) return;
        event.preventDefault();
        void primaryAction();
        return;
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        handleBackspace();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        backAction();
        return;
      }
      if (step === 'pay-vendor' && /^[a-zA-Z-]$/.test(event.key)) {
        event.preventDefault();
        pressChar(event.key.toUpperCase());
      }
    };
  });

  useEffect(() => {
    const listener = (event: globalThis.KeyboardEvent) => keyHandlerRef.current(event);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  function fillDemoNumber() {
    resetDraft();
    setStep('phone');
    setPhone('');
    setInput(demoPhone);
    setNote('Namba ya demo imewekwa. Bonyeza Tuma.');
    toast.success('Demo number inserted', { description: 'Press Tuma on the handset to open the menu.' });
  }

  const softKeys = (() => {
    switch (step) {
      case 'phone':
        return { left: 'Tuma', right: 'Futa', rightDisabled: false };
      case 'menu':
        return { left: 'Chagua', right: 'Toka', rightDisabled: false };
      case 'balance':
        return { left: 'Menyu', right: 'Toka', rightDisabled: false };
      case 'pay-vendor':
      case 'pay-amount':
      case 'pay-pin':
        return { left: 'Endelea', right: 'Rudi', rightDisabled: false };
      case 'pay-confirm':
        return { left: 'Lipa', right: 'Ghairi', rightDisabled: false };
      case 'pay-result':
      case 'topup-result':
        return { left: 'Menyu', right: 'Toka', rightDisabled: false };
      case 'topup-network':
        return { left: 'Chagua', right: 'Rudi', rightDisabled: false };
      case 'topup-amount':
        return { left: 'Tuma', right: 'Rudi', rightDisabled: false };
      case 'error':
        return { left: 'Jaribu', right: 'Menyu', rightDisabled: false };
      case 'exit':
        return { left: 'Anza', right: 'Toka', rightDisabled: true };
    }
  })();

  function renderScreen(): ReactNode {
    if (busy) {
      return (
        <div>
          <p className="text-primary-100">KUPON {shortCode}</p>
          <p className="mt-3">Tafadhali subiri...</p>
          <p className="mt-1 motion-safe:animate-pulse text-primary-500/80">Inasindika</p>
        </div>
      );
    }

    switch (step) {
      case 'phone':
        return (
          <div>
            <p className="text-primary-100">KUPON {shortCode}</p>
            <p className="mt-1">Karibu Kupon.</p>
            <p>Weka namba yako ya simu.</p>
            <ScreenInput value={input} />
            <p className="mt-2 text-primary-500/80">Mfano: {demoPhone || 'namba ya mwanafunzi'}</p>
          </div>
        );
      case 'menu':
        return (
          <div>
            <p className="text-primary-100">KUPON MENU</p>
            <p className="mt-1">1. Balance</p>
            <p>2. Pay vendor</p>
            <p>3. Top up</p>
            <p>4. Exit</p>
            <p className="mt-2 text-primary-500/80">Chagua (1-4)</p>
          </div>
        );
      case 'balance':
        return (
          <div>
            <p className="text-primary-100">SALIO</p>
            {balanceResult ? (
              <>
                <p className="mt-1">{balanceResult.studentName}</p>
                <p className="text-primary-500/80">
                  {balanceResult.university.code} · {balanceResult.studentNumber}
                </p>
                <p className="mt-2 text-base text-primary-100">
                  {formatTZS(balanceResult.balance)}
                </p>
                <p className="mt-2 text-primary-500/80">1. Menyu  2. Toka</p>
              </>
            ) : (
              <p className="mt-1">Salio halijapatikana.</p>
            )}
          </div>
        );
      case 'pay-vendor':
        return (
          <div>
            <p className="text-primary-100">LIPA VENDOR</p>
            <p className="mt-1">Weka namba ya vendor.</p>
            <ScreenInput value={input} />
            <p className="mt-2 text-primary-500/80">Mfano: {demoVendorSuffix}</p>
          </div>
        );
      case 'pay-amount':
        return (
          <div>
            <p className="text-primary-100">LIPA VENDOR</p>
            <p className="mt-1">Vendor: {vendor}</p>
            <p>Weka kiasi cha malipo (TZS).</p>
            <ScreenInput value={input} />
          </div>
        );
      case 'pay-pin':
        return (
          <div>
            <p className="text-primary-100">THIBITISHA</p>
            <p className="mt-1">
              {formatTZS(Number(amount))} · vendor {vendor}
            </p>
            <p>Weka PIN yako.</p>
            <ScreenInput value={input} masked />
            <p className="mt-2 text-primary-500/80">Demo PIN: 1234</p>
          </div>
        );
      case 'pay-confirm':
        return (
          <div>
            <p className="text-primary-100">THIBITISHA MALIPO</p>
            <p className="mt-1">
              Lipa {formatTZS(Number(amount))} kwa vendor {vendor}?
            </p>
            <p className="mt-1">1. NDIYO</p>
            <p>2. HAPANA</p>
          </div>
        );
      case 'pay-result':
        return (
          <div>
            <p className="text-primary-100">MALIPO YAMEFANIKIWA</p>
            {payResult ? (
              <>
                <p className="mt-1">{payResult.vendorName}</p>
                <p>{formatTZS(payResult.amount)}</p>
                <p className="mt-1">Salio: {formatTZS(payResult.balance)}</p>
                <p className="mt-1 text-primary-500/80">Ref {payResult.reference}</p>
              </>
            ) : null}
            <p className="mt-2 text-primary-500/80">1. Menyu  2. Toka</p>
          </div>
        );
      case 'topup-network':
        return (
          <div>
            <p className="text-primary-100">WEKA PESA</p>
            <p className="mt-1">Chagua mtandao:</p>
            {NETWORKS.map((item) => (
              <p key={item.id}>
                {item.key}. {item.label}
              </p>
            ))}
          </div>
        );
      case 'topup-amount':
        return (
          <div>
            <p className="text-primary-100">WEKA PESA</p>
            <p className="mt-1">Mtandao: {network?.label ?? 'M-Pesa'}</p>
            <p>Weka kiasi (TZS).</p>
            <ScreenInput value={input} />
            <p className="mt-2 text-primary-500/80">TZS 500 hadi 500,000</p>
          </div>
        );
      case 'topup-result':
        return (
          <div>
            <p className="text-primary-100">OMBI LIMEPOKELEWA</p>
            {topupResult ? (
              <>
                <p className="mt-1">
                  {formatTZS(topupResult.amount)} · {topupResult.networkLabel}
                </p>
                <p className="text-primary-500/80">Ref {topupResult.reference}</p>
                <p className="mt-1">Subiri uthibitisho wa mtandao.</p>
                <p className="mt-1">Salio: {formatTZS(topupResult.balance)}</p>
              </>
            ) : null}
            <p className="mt-2 text-primary-500/80">1. Menyu  2. Toka</p>
          </div>
        );
      case 'error':
        return (
          <div>
            <p className="text-amber-300">HITILAFU</p>
            <p className="mt-1 break-words">{failure?.message ?? 'Ombi halijakamilika.'}</p>
            <p className="mt-2 text-primary-500/80">1. Jaribu tena  2. Menyu</p>
          </div>
        );
      case 'exit':
        return (
          <div>
            <p className="text-primary-100">ASANTE</p>
            <p className="mt-1">Session imefungwa.</p>
            <p className="mt-2 text-primary-500/80">1. Anza tena</p>
          </div>
        );
    }
  }

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start lg:gap-8">
      <div className="mx-auto w-full max-w-[310px] lg:sticky lg:top-8">
        <div className="relative rounded-[2.5rem] border border-slate-800 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 p-3 shadow-lift">
          <div className="mx-auto mb-2 flex w-fit items-center gap-2" aria-hidden>
            <span className="h-1 w-12 rounded-full bg-slate-700" />
            <span className="h-2 w-2 rounded-full bg-slate-700" />
          </div>

          <div className="rounded-xl bg-[#081b11] p-3 ring-1 ring-black/60">
            <div className="flex items-center justify-between text-[9px] font-medium text-primary-500/80">
              <span className="flex items-center gap-1">
                <Signal className="h-2.5 w-2.5" strokeWidth={2.2} />
                {shortCode}
              </span>
              <span className="flex items-center gap-1">
                <BatteryFull className="h-2.5 w-2.5" strokeWidth={2.2} />
                KUPON
              </span>
            </div>

            <div
              className="hide-scrollbar mt-2 min-h-[286px] overflow-y-auto font-mono text-[12px] leading-[1.5] text-primary-300"
              aria-live="polite"
            >
              {renderScreen()}
              {note ? (
                <p className="mt-3 rounded border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-[10px] leading-snug text-amber-200">
                  {note}
                </p>
              ) : null}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-primary-500/20 pt-2 text-[9px] font-semibold uppercase tracking-wide text-primary-500/80">
              <span>{softKeys.left}</span>
              <span>{softKeys.right}</span>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void primaryAction()}
              disabled={busy}
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-2 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50"
            >
              {softKeys.left}
            </button>
            <button
              type="button"
              onClick={backAction}
              disabled={busy || softKeys.rightDisabled}
              className="min-h-[44px] rounded-lg border border-slate-700 bg-slate-800 px-2 text-[11px] font-semibold text-slate-100 transition hover:bg-slate-700 active:scale-[0.98] disabled:opacity-50"
            >
              {softKeys.right}
            </button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {KEYPAD.map((key) => (
              <button
                key={key.key}
                type="button"
                onClick={() => pressKey(key.key)}
                disabled={busy}
                aria-label={key.letters ? `Key ${key.key}, ${key.letters}` : `Key ${key.key}`}
                className="flex min-h-[46px] flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 py-1 text-base font-semibold text-slate-100 shadow-sm transition hover:bg-slate-700 active:scale-[0.97] disabled:opacity-50"
              >
                <span className="leading-none">{key.key}</span>
                {key.letters ? (
                  <span className="mt-0.5 text-[8px] font-medium tracking-[0.16em] text-slate-400">
                    {key.letters}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void primaryAction()}
              disabled={busy}
              aria-label="Send or confirm"
              className="flex min-h-[44px] items-center justify-center rounded-lg bg-primary-600 text-white transition hover:bg-primary-500 active:scale-[0.98] disabled:opacity-50"
            >
              <PhoneCall className="h-4 w-4" strokeWidth={2} />
            </button>
            <button
              type="button"
              onClick={resetSession}
              aria-label="End session"
              className="flex min-h-[44px] items-center justify-center rounded-lg bg-red-600 text-white transition hover:bg-red-500 active:scale-[0.98]"
            >
              <PhoneOff className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>

          <p className="mt-2 text-center text-[9px] font-semibold uppercase tracking-[0.3em] text-slate-500">
            Kupon
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
                <MessageSquare className="h-4 w-4" strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">SMS inbox</p>
                <p className="text-[11px] text-slate-500">
                  {smsLog.length} {smsLog.length === 1 ? 'message' : 'messages'} from KUPON
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSmsLog([])}
              disabled={smsLog.length === 0}
            >
              Clear
            </Button>
          </div>

          <div
            className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1"
            aria-live="polite"
            aria-label="SMS log"
          >
            {smsLog.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-4 py-8 text-center">
                <MessageSquare
                  className="mx-auto h-5 w-5 text-slate-300"
                  strokeWidth={1.8}
                />
                <p className="mt-2 text-xs font-medium text-slate-600">No messages yet</p>
                <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                  Run Balance, Pay vendor or Top up on the handset and the confirmation SMS
                  appears here.
                </p>
              </div>
            ) : (
              smsLog.map((entry) => (
                <div
                  key={entry.id}
                  className={cn(
                    'rounded-lg border p-3',
                    entry.kind === 'success' && 'border-primary-200 bg-primary-50/60',
                    entry.kind === 'pending' && 'border-amber-200 bg-amber-50/60',
                    entry.kind === 'failure' && 'border-red-200 bg-red-50/60',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wide',
                        entry.kind === 'success' && 'text-primary-700',
                        entry.kind === 'pending' && 'text-amber-700',
                        entry.kind === 'failure' && 'text-red-700',
                      )}
                    >
                      KUPON
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-400">{entry.at}</span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-700">{entry.message}</p>
                  <p className="mt-1 text-[10px] text-slate-400">To {maskPhone(entry.to)}</p>
                </div>
              ))
            )}
            <div ref={smsEndRef} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-card">
          <p className="text-sm font-semibold text-slate-900">Demo cheatsheet</p>
          <dl className="mt-3 divide-y divide-slate-100 text-xs">
            <div className="flex items-start justify-between gap-3 py-2 first:pt-0">
              <dt className="text-slate-500">Student number</dt>
              <dd className="text-right font-mono text-slate-800">{demoPhone || '—'}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 py-2">
              <dt className="text-slate-500">Vendor tills</dt>
              <dd className="text-right text-slate-800">
                {vendors.length > 0
                  ? vendors.map((vendor) => (
                      <span key={vendor.code} className="block">
                        {vendor.code.split('-').at(-1)} {vendor.name}
                      </span>
                    ))
                  : 'No active vendors'}
              </dd>
            </div>
            <div className="flex items-start justify-between gap-3 py-2">
              <dt className="text-slate-500">USSD PIN</dt>
              <dd className="font-mono text-slate-800">1234</dd>
            </div>
            <div className="flex items-start justify-between gap-3 py-2">
              <dt className="text-slate-500">Short code</dt>
              <dd className="font-mono text-slate-800">{shortCode}</dd>
            </div>
          </dl>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={fillDemoNumber}
            >
              Fill seeded number
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={resetEverything}
            >
              Reset simulation
            </Button>
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            Desktop keyboard works too: digits, Backspace, Enter to send and Escape to go back.
            Each action posts to the public demo route.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold text-slate-700">About this simulation</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            The browser posts a phone number to a public demo endpoint. In production the telco
            asserts the subscriber MSISDN over a trusted USSD session, so this page does not exist
            and the phone number, PIN and balance are never trusted from the browser.
          </p>
        </div>
      </div>
    </div>
  );
}
