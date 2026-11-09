'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Copy, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type TeamRole = 'STAFF' | 'FINANCE';
type VendorOption = { id: string; name: string; code: string };
type TeamAccount = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: TeamRole;
  createdAt: string;
  managedVendor: VendorOption | null;
};
type TeamInvite = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  vendor: VendorOption | null;
};
type TeamData = { vendors: VendorOption[]; accounts: TeamAccount[]; invites: TeamInvite[] };

export default function AdminTeamPage() {
  const [data, setData] = useState<TeamData>({ vendors: [], accounts: [], invites: [] });
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<TeamRole>('STAFF');
  const [vendorId, setVendorId] = useState('');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pollErrorShown = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const result = await apiFetch<TeamData>('/api/admin/team');
      setData(result);
      pollErrorShown.current = false;
      setVendorId((current) =>
        result.vendors.some((vendor) => vendor.id === current)
          ? current
          : result.vendors.length === 1
            ? result.vendors[0].id
            : '',
      );
    } catch (error) {
      if (!silent || !pollErrorShown.current) {
        toast.error(error instanceof ApiClientError ? error.message : 'Could not load team access.');
      }
      pollErrorShown.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setInviteUrl('');
    try {
      const result = await postJson<{ invite: { inviteUrl: string } }>('/api/admin/team', {
        name,
        email,
        phone,
        role,
        vendorId,
      });
      setName('');
      setEmail('');
      setPhone('');
      setInviteUrl(result.invite.inviteUrl);
      toast.success('Invitation created. Share the link with your team member.');
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not create the invite.');
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success('Invitation link copied.');
    } catch {
      toast.error('Could not copy the link. Select and copy it instead.');
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Cafeteria operations"
        title="Team access"
        description="Invite staff or Finance to an active cafeteria. The cafeteria owner remains responsible for their team."
      />
      <Alert variant="info">
        Each invitation is linked to one cafeteria, expires in seven days, and can be used once.
        The invitee chooses a password and can later sign in with the invited Google email.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Invite a team member</h2>
          {data.vendors.length === 0 && !loading ? (
            <Alert variant="warning" className="mt-4">
              No active cafeteria is available. Approve an application before assigning a team.
            </Alert>
          ) : null}
          <form onSubmit={createInvite} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="admin-team-role">Account type</Label>
              <select
                id="admin-team-role"
                value={role}
                onChange={(event) => setRole(event.target.value === 'FINANCE' ? 'FINANCE' : 'STAFF')}
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="STAFF">Cafeteria staff</option>
                <option value="FINANCE">Finance</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-team-vendor">Cafeteria</Label>
              <select
                id="admin-team-vendor"
                value={vendorId}
                onChange={(event) => setVendorId(event.target.value)}
                required
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
              >
                <option value="">Select a cafeteria</option>
                {data.vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name} ({vendor.code})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-team-name">Full name</Label>
              <Input
                id="admin-team-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-team-email">Google email</Label>
              <Input
                id="admin-team-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="admin-team-phone">Phone number</Label>
              <Input
                id="admin-team-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+255 7xx xxx xxx"
                required
              />
            </div>
            <Button type="submit" disabled={saving || data.vendors.length === 0} loading={saving}>
              <UserPlus className="h-4 w-4" />
              Create invitation
            </Button>
          </form>

          {inviteUrl ? (
            <div className="mt-5 space-y-2 rounded-xl border border-primary-200 bg-primary-50 p-3">
              <p className="text-xs font-semibold text-primary-900">Share this one-time link</p>
              <Input readOnly value={inviteUrl} aria-label="Team invitation link" />
              <Button type="button" variant="outline" className="w-full bg-white" onClick={copyInvite}>
                <Copy className="h-4 w-4" />
                Copy invitation link
              </Button>
            </div>
          ) : null}
        </Card>

        <Card className="p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" />
            <h2 className="text-base font-semibold text-slate-900">Team access</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {data.accounts.length + data.invites.length}
            </span>
          </div>
          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading team access…</p>
          ) : data.accounts.length === 0 && data.invites.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-relaxed text-slate-500">
              No team members yet. Create an invitation to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {data.invites.map((invite) => (
                <li key={invite.id} className="py-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{invite.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {invite.email} · {invite.vendor?.name}
                  </p>
                  <p className="mt-1 text-[10px] text-amber-700">
                    Invitation expires {formatDateTime(invite.expiresAt)}
                  </p>
                </li>
              ))}
              {data.accounts.map((account) => (
                <li key={account.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {account.email || account.phone} · {account.managedVendor?.name}
                    </p>
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
