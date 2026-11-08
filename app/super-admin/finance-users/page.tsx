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
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';

type VendorOption = {
  id: string;
  name: string;
  code: string;
  university: { name: string };
};

export default function TeamAccountsPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'STAFF' | 'FINANCE'>('FINANCE');
  const [vendorId, setVendorId] = useState('');
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch<{ vendors: VendorOption[] }>('/api/super-admin/finance-users')
      .then(({ vendors: options }) => {
        if (active) setVendors(options);
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

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform security"
        title="Team accounts"
        description="Create cafeteria-scoped staff and Finance accounts, or a platform-wide Finance account."
      />
      <Alert variant="warning">
        Staff can verify coupons and update today’s availability only. Finance can review scoped
        credit/support cases and monitor payments; nobody can manually confirm a checkout.
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
    </div>
  );
}
