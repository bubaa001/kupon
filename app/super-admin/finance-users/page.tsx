'use client';

import { useState } from 'react';
import { KeyRound, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, postJson } from '@/lib/client-api';

export default function FinanceUsersPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function createAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await postJson('/api/super-admin/finance-users', { name, phone, password });
      setName('');
      setPhone('');
      setPassword('');
      toast.success('Finance account created. The user can sign in at /staff/login.');
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
        title="Finance access"
        description="Create a platform-wide Finance account with access only to credit review and test-payment operations."
      />
      <Alert variant="warning">
        Use a unique password and deliver it securely. Finance accounts do not inherit platform
        admin permissions.
      </Alert>
      <Card className="max-w-2xl p-5 sm:p-6">
        <form onSubmit={createAccount} className="space-y-4">
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
            Create Finance account
          </Button>
        </form>
        <div className="mt-5 flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          The password is stored as a bcrypt hash and is never returned by the API.
        </div>
      </Card>
    </div>
  );
}
