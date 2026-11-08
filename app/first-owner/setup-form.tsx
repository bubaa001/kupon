'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, postJson } from '@/lib/client-api';

export function SetupForm() {
  const router = useRouter();
  const [setupToken, setSetupToken] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postJson('/api/auth/bootstrap-super-admin', {
        setupToken,
        name,
        email,
        phone,
        password,
      });
      toast.success('Platform owner account created.');
      router.replace('/admin');
      router.refresh();
    } catch (reason) {
      const message =
        reason instanceof ApiClientError
          ? reason.message
          : 'Could not create the platform owner account.';
      setError(message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {error ? <Alert variant="danger" title="Setup did not finish">{error}</Alert> : null}
      <div className="space-y-1.5">
        <Label htmlFor="setup-token">One-time setup token</Label>
        <Input
          id="setup-token"
          type="password"
          autoComplete="off"
          value={setupToken}
          onChange={(event) => setSetupToken(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-name">Your name</Label>
        <Input
          id="owner-name"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          minLength={2}
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-email">Email for Google sign-in</Label>
        <Input
          id="owner-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          maxLength={254}
          required
        />
        <p className="text-xs text-slate-500">
          Use the Google account you intend to link later.
        </p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-phone">Phone number</Label>
        <Input
          id="owner-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="+255 7xx xxx xxx"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner-password">Password</Label>
        <Input
          id="owner-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={12}
          maxLength={128}
          required
        />
        <p className="text-xs text-slate-500">
          Use at least 12 characters with lowercase, uppercase, and a number.
        </p>
      </div>
      <Button className="w-full" type="submit" loading={saving} disabled={saving}>
        Create platform owner account
      </Button>
    </form>
  );
}
