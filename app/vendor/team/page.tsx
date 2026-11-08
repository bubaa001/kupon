'use client';

import { useCallback, useEffect, useState } from 'react';
import { KeyRound, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';

type TeamRole = 'STAFF' | 'FINANCE';
type TeamAccount = {
  id: string;
  name: string;
  phone: string;
  role: TeamRole;
  createdAt: string;
};

export default function VendorTeamPage() {
  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<TeamRole>('STAFF');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const payload = await apiFetch<{ accounts: TeamAccount[] }>('/api/vendor/team');
      setAccounts(payload.accounts);
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not load team accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await postJson('/api/vendor/team', { name, phone, password, role });
      setName('');
      setPhone('');
      setPassword('');
      toast.success(`${role === 'STAFF' ? 'Staff' : 'Finance'} account created.`);
      await loadAccounts();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not create the account.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cafeteria operations"
        title="Team access"
        description="Create staff and Finance accounts for this cafeteria. Their access stays within your outlet."
      />
      <Alert variant="info">
        Staff can verify coupons and update today’s menu availability. Finance can review this
        cafeteria’s credit/support cases and monitor payment records. Payment confirmation is
        automatic; neither role can approve a student checkout.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Create an account</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Share the initial password securely. The team member can use it at the staff sign-in.
          </p>
          <form onSubmit={createAccount} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-role">Account type</Label>
              <select
                id="team-role"
                value={role}
                onChange={(event) =>
                  setRole(event.target.value === 'FINANCE' ? 'FINANCE' : 'STAFF')
                }
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="STAFF">Cafeteria staff</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-name">Full name</Label>
              <Input
                id="team-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-phone">Phone number</Label>
              <Input
                id="team-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+255 7xx xxx xxx"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-password">Initial password</Label>
              <Input
                id="team-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={128}
                required
              />
              <p className="text-[11px] text-slate-500">
                Use at least 12 characters with lowercase, uppercase, and a number.
              </p>
            </div>
            <Button type="submit" disabled={saving} loading={saving}>
              <UserPlus className="h-4 w-4" />
              Create {role === 'STAFF' ? 'staff' : 'Finance'} account
            </Button>
          </form>
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            Passwords are stored as bcrypt hashes and are never shown again.
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900">Your team</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {accounts.length}
            </span>
          </div>
          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading team accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-relaxed text-slate-500">
              No team accounts yet. Create one to give staff or Finance access to this cafeteria.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{account.phone}</p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      Added {formatDateTime(account.createdAt)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-700">
                    {account.role === 'STAFF' ? 'Staff' : 'Finance'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
