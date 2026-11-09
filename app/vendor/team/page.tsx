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
type TeamAccount = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: TeamRole;
  createdAt: string;
};
type TeamInvite = {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  expiresAt: string;
  createdAt: string;
};

export default function VendorTeamPage() {
  const [accounts, setAccounts] = useState<TeamAccount[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<TeamRole>('STAFF');
  const [inviteUrl, setInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const pollErrorShown = useRef(false);

  const loadTeam = useCallback(async (silent = false) => {
    try {
      const payload = await apiFetch<{ accounts: TeamAccount[]; invites: TeamInvite[] }>(
        '/api/vendor/team',
      );
      setAccounts(payload.accounts);
      setInvites(payload.invites);
      pollErrorShown.current = false;
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
    void loadTeam();
  }, [loadTeam]);
  useAutoRefresh(() => {
    void loadTeam(true);
  });

  async function createInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setInviteUrl('');
    try {
      const result = await postJson<{ invite: { inviteUrl: string } }>('/api/vendor/team', {
        name,
        email,
        phone,
        role,
      });
      setName('');
      setEmail('');
      setPhone('');
      setInviteUrl(result.invite.inviteUrl);
      toast.success('Invitation created. Share the link with your team member.');
      await loadTeam();
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
        description="Invite people to work under your cafeteria. You remain the owner and the only person who can invite this team."
      />
      <Alert variant="info">
        Staff verify coupons and update today’s menu. Finance can review this cafeteria’s records.
        Each invitation is linked to your cafeteria, expires in seven days, and can be used once.
      </Alert>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.9fr)]">
        <Card className="p-5 sm:p-6">
          <h2 className="text-base font-semibold text-slate-900">Invite a team member</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            They set a password after opening the link and can also use Google with this email.
          </p>
          <form onSubmit={createInvite} className="mt-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="team-role">Account type</Label>
              <select
                id="team-role"
                value={role}
                onChange={(event) => setRole(event.target.value === 'FINANCE' ? 'FINANCE' : 'STAFF')}
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
              <Label htmlFor="team-email">Google email</Label>
              <Input
                id="team-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
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
            <Button type="submit" disabled={saving} loading={saving}>
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
            <h2 className="text-base font-semibold text-slate-900">Your team</h2>
            <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              {accounts.length}
            </span>
          </div>
          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading team access…</p>
          ) : accounts.length === 0 && invites.length === 0 ? (
            <p className="mt-5 rounded-xl border border-dashed border-slate-200 p-4 text-sm leading-relaxed text-slate-500">
              No team members yet. Create an invitation to get started.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {invites.map((invite) => (
                <li key={invite.id} className="py-3">
                  <p className="truncate text-sm font-semibold text-slate-800">{invite.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{invite.email}</p>
                  <p className="mt-1 text-[10px] text-amber-700">
                    Invitation expires {formatDateTime(invite.expiresAt)}
                  </p>
                </li>
              ))}
              {accounts.map((account) => (
                <li key={account.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{account.name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {account.email || account.phone}
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
