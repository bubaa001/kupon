'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowRight, CheckCircle2, Mail, ShieldCheck } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiClientError, postJson } from '@/lib/client-api';
import { cn, isValidTzPhone, normalizePhone } from '@/lib/utils';

type FieldErrors = Partial<Record<'name' | 'phone' | 'studentId' | 'confirm', string>>;

export function GoogleSignupForm({
  email,
  name,
  university,
}: {
  email: string;
  name: string;
  university: { name: string; code: string; city: string };
}) {
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState('');
  const [studentId, setStudentId] = useState('');
  const [course, setCourse] = useState('');
  const [year, setYear] = useState('1');
  const [confirm, setConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validate() {
    const next: FieldErrors = {};
    if (fullName.trim().length < 2) next.name = 'Enter your full name.';
    if (!isValidTzPhone(phone)) next.phone = 'Use a valid Tanzanian number, e.g. +255 712 345 678.';
    if (studentId.trim().length < 3) next.studentId = 'Enter your student number.';
    if (!confirm) next.confirm = 'Confirm that these details are yours.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setSubmitting(true);
    try {
      const result = await postJson<{ redirectTo: string }>('/api/auth/google/signup', {
        name: fullName.trim(),
        phone: normalizePhone(phone),
        studentId: studentId.trim(),
        course: course.trim(),
        year: Number(year),
        confirm: true,
      });
      window.location.assign(result.redirectTo);
    } catch (error) {
      setFormError(
        error instanceof ApiClientError
          ? error.message
          : 'Could not create your account. Check your details and try again.',
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]"
    >
      <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.12),transparent_45%)] p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-600 shadow-sm ring-1 ring-slate-200">
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.82-.07-1.61-.2-2.36H12v4.47h6.47a5.53 5.53 0 0 1-2.4 3.63v3.02h3.88c2.27-2.09 3.57-5.17 3.57-8.76Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.9l-3.88-3.02c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.12A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.27 14.27a7.21 7.21 0 0 1 0-4.54V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.12Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.44-3.44C17.95 1.08 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.12C6.22 6.88 8.87 4.77 12 4.77Z"
              />
            </svg>
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-primary-800">
              Google verified
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            </p>
            <p className="truncate text-sm font-medium text-slate-800">{email}</p>
          </div>
          <ShieldCheck className="ml-auto h-5 w-5 shrink-0 text-primary-500" aria-hidden />
        </div>
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          You will not receive an SMS code. This Google email becomes your login. Pay for each order
          with Kupon at checkout; no student wallet is created.
        </p>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {formError ? (
          <Alert variant="danger" title="Could not create your account">
            {formError}
          </Alert>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="signup-name">Full name</Label>
          <Input
            id="signup-name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            autoComplete="name"
            error={Boolean(errors.name)}
            aria-describedby={errors.name ? 'signup-name-error' : undefined}
            placeholder="Your full name"
          />
          {errors.name ? (
            <p id="signup-name-error" className="text-[11px] font-medium text-red-600">
              {errors.name}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-phone">Mobile money number</Label>
          <Input
            id="signup-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            error={Boolean(errors.phone)}
            aria-describedby={errors.phone ? 'signup-phone-error' : 'signup-phone-help'}
            placeholder="+255 712 345 678"
          />
          <p id="signup-phone-help" className="text-[11px] text-slate-500">
            Used for order updates and checkout. No SMS verification is required.
          </p>
          {errors.phone ? (
            <p id="signup-phone-error" className="text-[11px] font-medium text-red-600">
              {errors.phone}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-student-id">Student number</Label>
          <Input
            id="signup-student-id"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value.toUpperCase())}
            autoCapitalize="characters"
            error={Boolean(errors.studentId)}
            aria-describedby={errors.studentId ? 'signup-student-error' : 'signup-student-help'}
            placeholder={`${university.code}/2024/CS/001`}
          />
          <p id="signup-student-help" className="text-[11px] text-slate-500">
            {university.code} · {university.name}
          </p>
          {errors.studentId ? (
            <p id="signup-student-error" className="text-[11px] font-medium text-red-600">
              {errors.studentId}
            </p>
          ) : null}
        </div>

        <div className="grid grid-cols-[1fr_100px] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-course">Course (optional)</Label>
            <Input
              id="signup-course"
              value={course}
              onChange={(event) => setCourse(event.target.value)}
              placeholder="e.g. Computer Science"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-year">Year</Label>
            <select
              id="signup-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="flex h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-800 shadow-sm focus-visible:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20"
            >
              {[1, 2, 3, 4, 5, 6].map((value) => (
                <option key={value} value={value}>
                  Year {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-900">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Ready to order
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-emerald-800/80">
            Pay for each meal at checkout through Kupon. Your orders and coupons remain in your
            account history.
          </p>
        </div>

        <label
          className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors',
            errors.confirm
              ? 'border-red-300 bg-red-50/50'
              : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50',
          )}
        >
          <input
            type="checkbox"
            checked={confirm}
            onChange={(event) => setConfirm(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500/30"
          />
          <span className="text-[11px] leading-relaxed text-slate-600">
            I am a student at {university.name} and these account details are mine.
            {errors.confirm ? (
              <span className="mt-1 block font-medium text-red-600">{errors.confirm}</span>
            ) : null}
          </span>
        </label>

        <Button type="submit" size="lg" loading={submitting} className="w-full">
          Create my account
          <ArrowRight aria-hidden />
        </Button>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-slate-500">
          Already have an account?
          <Link
            href="/login?role=student"
            className="font-semibold text-primary-700 underline-offset-2 hover:underline"
          >
            Sign in with OTP
          </Link>
        </p>
      </div>
    </form>
  );
}
