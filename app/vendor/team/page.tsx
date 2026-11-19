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
import { ApiClientError, apiFetch, deleteJson, patchJson, postJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type TeamRole = 'STAFF' | 'FINANCE';
type TeamAccount = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  role: TeamRole;
  createdAt: string;
  emergencyWithdrawalLimit: number;
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
                <PendingInviteRow key={invite.id} invite={invite} onChanged={() => void loadTeam(true)} />
              ))}
              {accounts.map((account) => (
                <TeamMemberRow key={account.id} account={account} onChanged={() => void loadTeam(true)} />
              ))}
            </ul>
          )}
        </Card>
      </div>
      <FinanceActivity />
    </div>
  );
}

function PendingInviteRow({ invite, onChanged }: { invite: TeamInvite; onChanged: () => void }) {
  const [cancelling, setCancelling] = useState(false);

  async function cancel() {
    if (!window.confirm(`Cancel the invitation for ${invite.name}? The link will stop working.`)) return;
    setCancelling(true);
    try {
      await deleteJson(`/api/vendor/team?inviteId=${encodeURIComponent(invite.id)}`);
      toast.success('Invitation cancelled');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not cancel this invitation.');
      setCancelling(false);
    }
  }

  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">{invite.name}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{invite.email}</p>
        <p className="mt-1 text-[11px] text-amber-700">
          Waiting to accept · expires {formatDateTime(invite.expiresAt)}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => void cancel()}
        loading={cancelling}
      >
        Cancel invite
      </Button>
    </li>
  );
}

type FinanceActivityItem = {
  id: string;
  who: string;
  what: string;
  amount: number | null;
  note: string | null;
  reference: string | null;
  at: string;
};

/** What Finance did with money, so the owner sees it even when away. */
function FinanceActivity() {
  const [items, setItems] = useState<FinanceActivityItem[] | null>(null);
  const load = useCallback(async () => {
    try {
      const payload = await apiFetch<{ items: FinanceActivityItem[] }>('/api/vendor/finance-activity');
      setItems(payload.items);
    } catch {
      setItems((previous) => previous ?? []);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load();
  });

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-base font-semibold text-navy">Finance activity</h2>
      <p className="mt-1 text-xs text-ink-muted">
        Every withdrawal and money decision your Finance people made, newest first.
      </p>
      {items === null ? (
        <p className="mt-4 text-sm text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-navy/15 p-4 text-sm text-ink-muted">
          Nothing yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-navy/[0.07]">
          {items.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-navy">
                  {item.who} · {item.what}
                </p>
                {item.note ? <p className="mt-0.5 text-xs text-ink-muted">{item.note}</p> : null}
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {formatDateTime(item.at)}
                  {item.reference ? ` · ${item.reference}` : ''}
                </p>
              </div>
              {item.amount !== null ? (
                <span className="shrink-0 text-sm font-semibold tabular text-navy">
                  {formatTZS(item.amount)}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function TeamMemberRow({ account, onChanged }: { account: TeamAccount; onChanged: () => void }) {
  const [limit, setLimit] = useState(String(account.emergencyWithdrawalLimit || ''));
  const [savingLimit, setSavingLimit] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function saveLimit() {
    setSavingLimit(true);
    try {
      await patchJson('/api/vendor/team', {
        userId: account.id,
        dailyWithdrawalLimit: Number(limit.replace(/[^\d]/g, '')) || 0,
      });
      toast.success('Withdrawal limit saved');
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not save the limit.');
    } finally {
      setSavingLimit(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove ${account.name}? They will no longer be able to sign in. Their past actions stay in your records.`)) {
      return;
    }
    setRemoving(true);
    try {
      await deleteJson(`/api/vendor/team?userId=${encodeURIComponent(account.id)}`);
      toast.success(`${account.name} removed`);
      onChanged();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not remove this account.');
      setRemoving(false);
    }
  }

  return (
    <li className="space-y-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy">{account.name}</p>
          <p className="mt-0.5 truncate text-xs text-ink-muted">{account.email || account.phone}</p>
          <p className="mt-1 text-[11px] text-ink-muted">Added {formatDateTime(account.createdAt)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-navy-50 px-2.5 py-1 text-[11px] font-semibold text-navy">
          {account.role === 'STAFF' ? 'Staff' : 'Finance'}
        </span>
      </div>
      {account.role === 'FINANCE' ? (
        <div className="space-y-1.5">
          <Label htmlFor={`limit-${account.id}`} className="text-xs">
            Can withdraw per day without you (TZS)
          </Label>
          <div className="flex gap-2">
            <Input
              id={`limit-${account.id}`}
              inputMode="numeric"
              value={limit}
              onChange={(event) => setLimit(event.target.value.replace(/[^\d]/g, ''))}
              placeholder="0 = not allowed"
            />
            <Button type="button" variant="outline" onClick={() => void saveLimit()} loading={savingLimit}>
              Save
            </Button>
          </div>
          <p className="text-[11px] text-ink-muted">
            {account.emergencyWithdrawalLimit > 0
              ? `Now ${formatTZS(account.emergencyWithdrawalLimit)} a day. You see every withdrawal they make.`
              : 'Withdrawals are off for this person.'}
          </p>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => void remove()}
        disabled={removing}
        className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
      >
        {removing ? 'Removing…' : 'Remove from team'}
      </button>
    </li>
  );
}
