'use client';

import { useEffect, useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, patchJson, postJson } from '@/lib/client-api';
import { MIN_WITHDRAWAL } from '@/lib/constants';

type VendorOption = {
  id: string;
  name: string;
  code: string;
  university: { name: string };
};

type FinanceAccount = {
  id: string;
  name: string;
  phone: string | null;
  emergencyWithdrawalLimit: number;
  managedVendor: { id: string; name: string; code: string } | null;
};

type EmergencyWithdrawal = {
  id: string;
  actorName: string;
  vendorName: string;
  vendorCode: string;
  amount: number;
  reason: string;
  reference: string;
  createdAt: string;
};

export default function TeamAccountsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STAFF' | 'FINANCE'>('FINANCE');
  const [vendorId, setVendorId] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [emergencyWithdrawals, setEmergencyWithdrawals] = useState<EmergencyWithdrawal[]>([]);
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingLimit, setSavingLimit] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    apiFetch<{
      vendors: VendorOption[];
      accounts: FinanceAccount[];
      emergencyWithdrawals: EmergencyWithdrawal[];
    }>('/api/super-admin/finance-users')
      .then(({ vendors: options, accounts: financeAccounts, emergencyWithdrawals: withdrawals }) => {
        if (active) {
          setVendors(options);
          setAccounts(financeAccounts);
          setEmergencyWithdrawals(withdrawals);
          setLimits(
            Object.fromEntries(
              financeAccounts.map((account) => [
                account.id,
                String(account.emergencyWithdrawalLimit),
              ]),
            ),
          );
        }
      })
      .catch((error) => {
        if (active) {
          toast.error(
            error instanceof ApiClientError ? error.message : 'Could not load active cafeterias.',
          );
        }
      })
      .finally(() => {
        if (active) setLoadingVendors(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await postJson('/api/super-admin/finance-users', {
        name,
        phone,
        password,
        role,
        vendorId: vendorId || undefined,
      });
      setName('');
      setPhone('');
      setPassword('');
      toast.success(`${role === 'STAFF' ? 'Staff' : 'Finance'} account created. Sign-in: /staff/login.`);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  async function saveLimit(account: FinanceAccount) {
    const emergencyWithdrawalLimit = Number(limits[account.id] ?? 0);
    if (!Number.isSafeInteger(emergencyWithdrawalLimit) || emergencyWithdrawalLimit < 0) {
      toast.error('Enter a non-negative whole-shilling limit.');
      return;
    }
    if (emergencyWithdrawalLimit !== 0 && emergencyWithdrawalLimit < MIN_WITHDRAWAL) {
      toast.error(`Use 0 to disable or set a limit of at least TZS ${MIN_WITHDRAWAL.toLocaleString()}.`);
      return;
    }
    setSavingLimit(account.id);
    try {
      await patchJson('/api/super-admin/finance-users', {
        userId: account.id,
        emergencyWithdrawalLimit,
      });
      setAccounts((current) =>
        current.map((item) =>
          item.id === account.id ? { ...item, emergencyWithdrawalLimit } : item,
        ),
      );
      toast.success(
        emergencyWithdrawalLimit === 0
          ? 'Emergency withdrawal access disabled.'
          : `Emergency withdrawal limit set to TZS ${emergencyWithdrawalLimit.toLocaleString()}.`,
      );
    } catch (error) {
      toast.error(
        error instanceof ApiClientError ? error.message : 'Could not update the withdrawal limit.',
      );
    } finally {
      setSavingLimit(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform security"
        title="Team accounts"
        description="Create cafeteria-scoped staff and Finance accounts, or a platform-wide Finance account."
      />
      <Alert variant="warning">
        Staff can verify coupons and update today’s availability only. Finance can review scoped
        credit/support cases. Emergency withdrawals are disabled unless an admin grants a
        per-account limit; settlements remain test simulations and send no money.
      </Alert>
      <Card className="max-w-2xl p-5 sm:p-6">
        <form onSubmit={createAccount} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="account-role">Account type</Label>
            <select
              id="account-role"
              value={role}
              onChange={(event) => {
                const nextRole = event.target.value === 'STAFF' ? 'STAFF' : 'FINANCE';
                setRole(nextRole);
                if (nextRole === 'STAFF' && !vendorId && vendors.length === 1) {
                  setVendorId(vendors[0].id);
                }
              }}
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
            >
              <option value="FINANCE">Finance</option>
              <option value="STAFF">Cafeteria staff</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="account-vendor">
              Cafeteria scope{role === 'STAFF' ? ' (required)' : ''}
            </Label>
            <select
              id="account-vendor"
              value={vendorId}
              onChange={(event) => setVendorId(event.target.value)}
              required={role === 'STAFF'}
              disabled={loadingVendors}
              className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">
                {loadingVendors ? 'Loading cafeterias…' : 'Platform-wide Finance access'}
              </option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.university.name} · {vendor.name} ({vendor.code})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500">
              Staff accounts must belong to one active cafeteria. Finance may be platform-wide.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-name">Full name</Label>
            <Input id="finance-name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={80} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-phone">Phone number</Label>
            <Input
              id="finance-phone"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+255 7xx xxx xxx"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="finance-password">Temporary password</Label>
            <Input
              id="finance-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              maxLength={128}
              required
            />
            <p className="text-[11px] text-slate-500">
              At least 12 characters with lowercase, uppercase, and a number.
            </p>
          </div>
          <Button type="submit" disabled={saving} loading={saving}>
            <UserPlus className="h-4 w-4" />
            Create {role === 'STAFF' ? 'staff' : 'Finance'} account
          </Button>
        </form>
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          The password is stored as a bcrypt hash and is never returned by the API. Share the
          temporary password securely.
        </div>
      </Card>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Finance emergency limits</h2>
          <p className="mt-1 text-xs text-slate-500">
            Limits apply per withdrawal, only to the assigned cafeteria, and can be set to 0 to
            revoke access. Every withdrawal requires a reason and is audit-logged.
          </p>
        </div>
        {accounts.length ? accounts.map((account) => (
          <Card key={account.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{account.name}</p>
              <p className="mt-1 text-xs text-slate-500">
                {account.phone ?? 'No phone'} · {account.managedVendor
                  ? `${account.managedVendor.name} (${account.managedVendor.code})`
                  : 'Platform-wide Finance (not eligible for withdrawals)'}
              </p>
            </div>
            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <Label htmlFor={`withdrawal-limit-${account.id}`}>Per-withdrawal limit (TZS)</Label>
                <Input
                  id={`withdrawal-limit-${account.id}`}
                  type="number"
                  min={0}
                  max={5_000_000}
                  step={1}
                  value={limits[account.id] ?? '0'}
                  onChange={(event) =>
                    setLimits((current) => ({ ...current, [account.id]: event.target.value }))
                  }
                  disabled={!account.managedVendor}
                  className="w-48"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                disabled={!account.managedVendor || savingLimit === account.id}
                loading={savingLimit === account.id}
                onClick={() => void saveLimit(account)}
              >
                Save limit
              </Button>
            </div>
          </Card>
        )) : (
          <Card className="p-4 text-sm text-slate-500">No Finance accounts have been created yet.</Card>
        )}
      </section>
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Emergency withdrawal audit</h2>
          <p className="mt-1 text-xs text-slate-500">
            Finance requests and reasons are visible here. Entries are simulated settlements only;
            no funds are sent.
          </p>
        </div>
        {emergencyWithdrawals.length ? emergencyWithdrawals.map((withdrawal) => (
          <Card key={withdrawal.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">
                TZS {withdrawal.amount.toLocaleString()} · {withdrawal.vendorName}
                {withdrawal.vendorCode ? ` (${withdrawal.vendorCode})` : ''}
              </p>
              <p className="text-xs text-slate-500">{new Date(withdrawal.createdAt).toLocaleString()}</p>
            </div>
            <p className="mt-1 text-xs text-slate-600">
              Requested by {withdrawal.actorName} · {withdrawal.reference}
            </p>
            <p className="mt-2 text-sm text-slate-700">{withdrawal.reason || 'No reason recorded'}</p>
          </Card>
        )) : (
          <Card className="p-4 text-sm text-slate-500">No emergency withdrawals have been recorded.</Card>
        )}
      </section>
    </div>
  );
}
