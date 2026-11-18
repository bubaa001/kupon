'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { SNIPPE_BANKS, type PayoutAccount } from '@/lib/payouts/payout-account';

type Data = { account: PayoutAccount | null; label: string; ready: boolean };

/** Owner sets where withdrawals are sent: a mobile money number or a bank account. */
export function PayoutAccountForm() {
  const [data, setData] = useState<Data | null>(null);
  const [method, setMethod] = useState<'mobile' | 'bank'>('mobile');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bank, setBank] = useState<string>('CRDB');
  const [account, setAccount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Data>('/api/vendor/payout-account')
      .then((result) => {
        setData(result);
        if (result.account) {
          setMethod(result.account.method);
          setName(result.account.name);
          if (result.account.method === 'mobile') setPhone(result.account.phone);
          else {
            setBank(result.account.bank);
            setAccount(result.account.account);
          }
        }
      })
      .catch(() => setData({ account: null, label: 'No payout details yet', ready: false }));
  }, []);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const body = method === 'mobile' ? { method, name, phone } : { method, name, bank, account };
      const result = await apiFetch<Data>('/api/vendor/payout-account', {
        method: 'PUT',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });
      setData(result);
      toast.success('Payout details saved', { description: result.label });
    } catch (cause) {
      setError(cause instanceof ApiClientError ? cause.message : 'Could not save payout details.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600">
          <Wallet className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-navy">Where withdrawals go</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {data ? `Now: ${data.label}` : 'Loading…'}
          </p>
        </div>
      </div>

      <form onSubmit={save} className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1" role="group" aria-label="Payout method">
          {(
            [
              ['mobile', 'Mobile money'],
              ['bank', 'Bank account'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMethod(value)}
              aria-pressed={method === value}
              className={
                method === value
                  ? 'min-h-10 rounded-lg bg-white text-sm font-semibold text-navy shadow-sm'
                  : 'min-h-10 rounded-lg text-sm font-medium text-ink-muted'
              }
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="payout-name">Account holder name</Label>
          <Input id="payout-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>

        {method === 'mobile' ? (
          <div className="space-y-1.5">
            <Label htmlFor="payout-phone">Mobile money number</Label>
            <Input
              id="payout-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0712 345 678"
              required
            />
          </div>
        ) : (
          <div className="grid grid-cols-[8rem_1fr] gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="payout-bank">Bank</Label>
              <select
                id="payout-bank"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="flex h-11 w-full rounded-lg border border-navy/15 bg-white px-3 text-sm text-navy"
              >
                {SNIPPE_BANKS.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payout-account">Account number</Label>
              <Input
                id="payout-account"
                inputMode="numeric"
                value={account}
                onChange={(e) => setAccount(e.target.value.replace(/\s/g, ''))}
                required
              />
            </div>
          </div>
        )}

        {error ? <p className="text-xs font-medium text-red-600">{error}</p> : null}
        <Button type="submit" className="w-full" loading={saving}>
          Save payout details
        </Button>
        <p className="text-[11px] text-ink-muted">
          Changes are recorded in your activity log. Each withdrawal is charged the Kupon
          withdrawal fee.
        </p>
      </form>
    </Card>
  );
}
