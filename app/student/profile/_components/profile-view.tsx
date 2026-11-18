'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  BookOpen,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  GraduationCap,
  Hash,
  History,
  LogOut,
  Mail,
  Phone,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Ticket,
  UtensilsCrossed,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { signOut } from '@/lib/logout';
import { cn, formatDate, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';
import { ErrorState } from '../../_components/error-state';
import type { StudentProfileData } from '../../_lib/types';

export type ProfileIdentity = {
  /** Email already linked to this student account (masked in the UI). */
  email: string | null;
  /** Whether a Google `sub` is stored — i.e. Google sign-in is active. */
  googleLinked: boolean;
  /** Last successful sign-in, ISO string. */
  lastLoginAt: string | null;
};

function ProfileSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Skeleton className="h-[136px] w-full rounded-2xl" />
      <Skeleton className="h-[168px] w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[96px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[200px] w-full rounded-xl" />
    </div>
  );
}

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function StatLink({
  href,
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: string;
  hint: string;
  icon: LucideIcon;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-[96px] flex-col justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-card transition-colors hover:border-primary-200 hover:bg-primary-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70 focus-visible:ring-offset-2"
    >
      <div className="flex items-center justify-between">
        <span
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tone)}
          aria-hidden
        >
          <Icon className="h-4 w-4" />
        </span>
        <ChevronRight
          className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-500"
          aria-hidden
        />
      </div>
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
          {label}
        </p>
        <p className="mt-0.5 truncate text-base font-semibold tabular text-slate-900">{value}</p>
        <p className="text-[10px] text-slate-400">{hint}</p>
      </div>
    </Link>
  );
}

function ActionRow({
  href,
  icon: Icon,
  title,
  description,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[56px] items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/70"
    >
      <span
        className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tone)}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold text-slate-800">{title}</span>
        <span className="block text-[10px] leading-relaxed text-slate-500">{description}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />
    </Link>
  );
}

/**
 * Profile/settings screen for a Google-first student. Identity comes from the
 * server session, while ordering stats refresh through the student API.
 */
export function ProfileView({ identity }: { identity: ProfileIdentity }) {
  const [data, setData] = useState<StudentProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<StudentProfileData>('/api/student/profile'));
    } catch (reason) {
      setError(
        reason instanceof ApiClientError
          ? reason.message
          : 'We could not load your profile.',
      );
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

  if (loading && !data) return <ProfileSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Akaunti"
          title="My profile"
          description="Your university details, orders and account security."
        />
        <ErrorState message={error ?? 'We could not load your profile.'} onRetry={() => void load()} />
      </div>
    );
  }

  const { student, university, stats } = data;
  // Staff, lecturers and visitors sign up without a student number.
  const isGuest = student.studentId.startsWith('GUEST-');
  const googleEmail = identity.email ? maskEmail(identity.email) : null;
  const googleState = identity.googleLinked
    ? { label: 'Google session', variant: 'success' as const, dot: true }
    : identity.email
      ? { label: 'Google not linked', variant: 'warning' as const, dot: true }
      : { label: 'No Google account', variant: 'neutral' as const, dot: false };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Account"
        title="My profile"
        description="Your university details, orders and session security."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCcw aria-hidden />
            Refresh
          </Button>
        }
      />

      {/* Identity */}
      <Card className="overflow-hidden rounded-2xl p-0">
        <div className="relative overflow-hidden bg-navy px-5 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent" />
          <div className="relative flex items-start gap-3">
            <Avatar name={student.name} size="lg" className="ring-2 ring-white/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-white">
                {student.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-300">
                {isGuest ? 'Campus guest' : student.studentId} • {university.code}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                  Year {student.year}
                </Badge>
                <Badge
                  variant={googleState.variant}
                  dot={googleState.dot}
                  className="border-white/20 bg-white/10 text-white"
                >
                  <BadgeCheck className="h-3 w-3" aria-hidden />
                  {googleState.label}
                </Badge>
              </div>
            </div>
          </div>
          <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-[11px] text-slate-300">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {googleEmail ?? 'No email linked'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {student.phone}
            </span>
          </div>
        </div>
      </Card>

      <Card className="flex flex-col gap-4 rounded-2xl p-5 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Pay per order</p>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-slate-500">
            Kupon holds no balance for you. You pay when you order, and the coupon is issued once
            the payment is confirmed.
          </p>
          <p className="mt-3 text-xs text-slate-500">
            Recorded spend: <strong className="text-slate-800">{formatTZS(stats.totalSpent)}</strong>
            <span className="px-1.5 text-slate-300">•</span>
            {stats.transactionsCount} transactions
          </p>
        </div>
        <Button asChild className="shrink-0">
          <Link href="/student/pay">
            <ScanLine aria-hidden />
            Start an order
          </Link>
        </Button>
      </Card>

      {/* Stats that link to the next action */}
      <div className="grid grid-cols-2 gap-2">
        <StatLink
          href="/student/pay"
          label="Coupons"
          value={String(stats.pendingCoupons)}
          hint="Waiting for cafeteria"
          icon={Ticket}
          tone="bg-navy-50 text-navy"
        />
        <StatLink
          href="/student/credit-requests"
          label="Credit & support"
          value={String(stats.pendingCreditRequests)}
          hint="Open cafeteria cases"
          icon={Ticket}
          tone="bg-navy-50 text-navy"
        />
        <StatLink
          href="/student/history"
          label="Spending"
          value={formatTZS(stats.totalSpent)}
          hint={`${stats.mealsCount} paid orders`}
          icon={UtensilsCrossed}
          tone="bg-navy-50 text-navy"
        />
      </div>

      {/* Quick links */}
      <Card className="p-3">
        <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
          Shortcuts
        </p>
        <div className="divide-y divide-slate-100">
          <ActionRow
            href="/student/pay"
            icon={Ticket}
            title="My coupons"
            description="Show a coupon at the counter or cancel a waiting order"
            tone="bg-navy-50 text-navy"
          />
          <ActionRow
            href="/student/history"
            icon={History}
            title="Order history"
            description="Payments, coupons and credits"
            tone="bg-navy-50 text-navy"
          />
          <ActionRow
            href="/student/credit-requests"
            icon={Ticket}
            title="Credit & support"
            description="Report an unfulfilled order or ask for a further review"
            tone="bg-navy-50 text-navy"
          />
        </div>
      </Card>

      {/* Campus details */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">University details</p>
        <div className="mt-2 divide-y divide-slate-100">
          {isGuest ? null : (
            <DetailRow icon={Hash} label="Student number" value={student.studentId} />
          )}
          <DetailRow
            icon={Building2}
            label="University"
            value={`${university.name}${university.city ? ` • ${university.city}` : ''}`}
          />
          <DetailRow icon={BookOpen} label="Course" value={student.course} />
          <DetailRow icon={GraduationCap} label="Year of study" value={`Year ${student.year}`} />
          <DetailRow icon={Phone} label="Phone" value={student.phone} />
          <DetailRow
            icon={CalendarDays}
            label="Member since"
            value={formatDate(student.joinedAt, 'dd MMM yyyy')}
          />
        </div>
      </Card>

      {/* Google-first session + security */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
            <ShieldCheck className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Your session</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Kupon uses <span className="font-semibold text-slate-700">Google Sign-In</span>.
              You need no OTP or password: Google verifies your account.
            </p>
          </div>
        </div>

        <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-[11px]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Mail className="h-3.5 w-3.5" aria-hidden />
              Google email
            </span>
            <span className="min-w-0 truncate font-medium text-slate-800">
              {googleEmail ?? '—'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500">
              <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
              Status
            </span>
            <Badge variant={googleState.variant} dot={googleState.dot}>
              {identity.googleLinked ? 'Linked' : 'Not linked'}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Last sign-in
            </span>
            <span
              className="font-medium text-slate-800"
              title={identity.lastLoginAt ? relativeTime(identity.lastLoginAt) : undefined}
            >
              {identity.lastLoginAt ? formatDateTime(identity.lastLoginAt) : '—'}
            </span>
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          {identity.googleLinked
            ? 'You are signed in with Google on this device. If you sign out, you will choose your Google account again.'
            : identity.email
              ? 'Use this email to sign in with Google. If your Google account uses a different email, ask your university admin to link it.'
              : 'No Google email is linked. Ask your university admin to link one before you sign in with Google.'}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Never share your coupon code with anyone except the cafeteria counter serving your meal.
          Order payments appear once the payment system confirms them.
        </p>

        <Button
          variant="outline"
          className="mt-3 h-11 w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden />
          Sign out
        </Button>
      </Card>

      {/* PWA */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy">
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Install Kupon on your phone</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Kupon is a Progressive Web App (PWA): add it to your home screen and use it like a
              normal app, with no Play Store needed.
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">Android (Chrome):</span> menu ⋮ → “Add
            to Home screen”.
          </p>
          <p>
            <span className="font-semibold text-slate-800">iPhone (Safari):</span> Share → “Add to
            Home Screen”.
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="neutral">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Secure
          </Badge>
          <Badge variant="neutral">Scan &amp; order</Badge>
          <Badge variant="neutral">No OTP</Badge>
        </div>
      </Card>
    </div>
  );
}
