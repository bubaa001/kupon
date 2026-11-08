'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, postJson } from '@/lib/client-api';

export function VendorActivationForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await postJson<{ redirectTo: string }>('/api/auth/vendor-activate', {
        password,
      });
      toast.success('Your vendor account is ready.');
      router.replace(result.redirectTo);
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof ApiClientError
          ? reason.message
          : 'Could not finish setting up your account.',
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="danger" title="Account setup failed">{error}</Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor="vendor-new-password">Create a password</Label>
        <Input
          id="vendor-new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          maxLength={128}
          required
        />
        <p className="text-xs text-slate-500">
          Use at least 8 characters. You choose this password for your vendor account.
        </p>
      </div>
      <Button type="submit" className="w-full" loading={saving} disabled={saving}>
        Create password and activate account
      </Button>
    </form>
  );
}
