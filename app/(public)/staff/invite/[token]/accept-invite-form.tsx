'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';

type InviteDetails = {
  name: string;
  email: string;
  role: string;
  vendorName: string;
  expiresAt: string;
};

export function AcceptInviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch<{ invite: InviteDetails }>(`/api/auth/staff-invites/${encodeURIComponent(token)}`)
      .then((result) => {
        if (active) setInvite(result.invite);
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof ApiClientError
              ? reason.message
              : 'This invitation could not be verified.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await postJson<{ redirectTo: string }>(
        `/api/auth/staff-invites/${encodeURIComponent(token)}`,
        { password },
      );
      toast.success('Your Kupon access is ready.');
      router.replace(result.redirectTo);
      router.refresh();
    } catch (reason) {
      const message =
        reason instanceof ApiClientError
          ? reason.message
          : 'Could not accept this invitation. Ask the cafeteria owner for help.';
      setError(message);
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Checking invitation…</p>;
  if (error && !invite) {
    return <Alert variant="danger" title="Invitation unavailable">{error}</Alert>;
  }
  if (!invite) return null;

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="danger" title="Could not accept invitation">{error}</Alert> : null}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
        <p className="font-semibold text-slate-900">{invite.name}</p>
        <p className="mt-1 break-all text-xs text-slate-600">{invite.email}</p>
        <p className="mt-1 text-xs text-slate-600">
          {invite.role === 'STAFF' ? 'Cafeteria staff' : 'Finance'} · {invite.vendorName}
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="invite-password">Create a password</Label>
        <Input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          maxLength={128}
          required
        />
        <p className="text-xs text-slate-500">
          At least 12 characters with lowercase, uppercase, and a number.
        </p>
      </div>
      <Button className="w-full" type="submit" loading={saving} disabled={saving}>
        Accept invitation
      </Button>
    </form>
  );
}
