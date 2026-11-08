'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { ApiClientError, apiFetch, postJson } from '@/lib/client-api';
import { normalizePhone } from '@/lib/utils';

type University = { id: string; name: string; code: string };
type LoginResult = { user: { name: string }; redirectTo: string };

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden focusable="false">
      <path fill="#4285F4" d="M23.52 12.27c0-.82-.07-1.61-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.76Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.21 7.21 0 0 1 0-4.54V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.12Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.44-3.44C17.95 1.08 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

export function VendorAccessForm() {
  const router = useRouter();
  const [universities, setUniversities] = useState<University[]>([]);
  const [universityId, setUniversityId] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch<{ universities: University[] }>('/api/universities')
      .then(({ universities: rows }) => {
        if (!active) return;
        setUniversities(rows);
        setUniversityId(rows.find((row) => row.code === 'UDSM')?.id ?? rows[0]?.id ?? '');
      })
      .catch((reason) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : 'Could not load the campus list.');
        }
      });

    const params = new URLSearchParams(window.location.search);
    if (params.get('error')) {
      setError(
        params.get('error') === 'google_vendor_suspended'
          ? 'This cafeteria account is suspended. Contact Kupon support.'
          : 'Google sign-in could not be completed. Check your account and try again.',
      );
      window.history.replaceState({}, '', '/vendor/login');
    }
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const result = await postJson<LoginResult>('/api/auth/vendor-password-login', {
        phone: normalizePhone(phone),
        password,
      });
      toast.success(`Welcome back, ${result.user.name}.`);
      router.replace(result.redirectTo);
      router.refresh();
    } catch (reason) {
      const message =
        reason instanceof ApiClientError ? reason.message : 'Could not sign in to this account.';
      setError(message);
      setLoading(false);
    }
  }

  function googleSignIn() {
    if (!universityId) {
      setError('Choose the university where your cafeteria operates.');
      return;
    }
    setGoogleLoading(true);
    const params = new URLSearchParams({ universityId, role: 'vendor' });
    window.location.assign(`/api/auth/google/start?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      {error ? <Alert variant="danger" title="Sign in or application failed">{error}</Alert> : null}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="vendor-phone">Phone number</Label>
          <Input
            id="vendor-phone"
            type="tel"
            inputMode="tel"
            autoComplete="username"
            placeholder="+255 7xx xxx xxx"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="vendor-password">Password</Label>
          <div className="relative">
            <Input
              id="vendor-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="pr-11"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-1 top-1 flex h-9 w-9 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <Button type="submit" className="w-full" loading={loading} disabled={loading}>
          Sign in with phone and password
          <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="relative flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
          or Google
        </span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="vendor-university">University</Label>
          <Select
            id="vendor-university"
            value={universityId}
            onChange={(event) => setUniversityId(event.target.value)}
            disabled={universities.length === 0}
          >
            <option value="">Select your campus</option>
            {universities.map((university) => (
              <option key={university.id} value={university.id}>
                {university.name} ({university.code})
              </option>
            ))}
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full bg-white"
          onClick={googleSignIn}
          loading={googleLoading}
          disabled={googleLoading || universities.length === 0}
        >
          <GoogleGlyph />
          Continue with Google or apply
        </Button>
        <p className="text-center text-[11px] leading-relaxed text-slate-500">
          Google signs in to an existing account or starts a cafeteria application for review.
        </p>
      </div>
    </div>
  );
}
