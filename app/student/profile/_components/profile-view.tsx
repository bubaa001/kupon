'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BadgeCheck,
  Banknote,
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
  PlusCircle,
  RefreshCcw,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Ticket,
  UtensilsCrossed,
  Wallet,
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
import type { OrderView, StudentOrdersData } from '@/lib/orders/types';
import { ErrorState } from '../../_components/error-state';
import type { StudentProfileData } from '../../_lib/types';

export type ProfileIdentity = {
  /** Email already linked to this wallet (masked in the UI). */
  email: string | null;
  /** Whether a Google `sub` is stored — i.e. Google sign-in is active. */
  googleLinked: boolean;
  /** Last successful sign-in, ISO string. */
  lastLoginAt: string | null;
};

/**
 * Minimal structural view of the two money-request endpoints. Refunds (order
 * refunds) and withdrawals (cash out) are deliberately separate products, so
 * the profile counts each queue independently instead of implying one is the
 * other.
 */
type MoneyRequestList = {
  requests?: Array<{ status?: string }>;
};

function countPendingRequests(value: MoneyRequestList | null): number | null {
  if (!value || !Array.isArray(value.requests)) return null;
  return value.requests.filter((request) => request?.status === 'PENDING').length;
}

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
 * Profile/settings screen for a Google-first student wallet. Identity comes from
 * the server session (so it never trusts a client-supplied email), while the
 * wallet and stats refresh through the student API.
 */
export function ProfileView({ identity }: { identity: ProfileIdentity }) {
  const [data, setData] = useState<StudentProfileData | null>(null);
  const [pendingOrders, setPendingOrders] = useState<OrderView[]>([]);
  const [money, setMoney] = useState<{ refunds: number | null; withdrawals: number | null }>({
    refunds: null,
    withdrawals: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [profileResult, ordersResult, refundsResult, withdrawalsResult] = await Promise.allSettled([
      apiFetch<StudentProfileData>('/api/student/profile'),
      apiFetch<StudentOrdersData>('/api/student/orders?status=PENDING'),
      apiFetch<MoneyRequestList>('/api/student/refunds'),
      apiFetch<MoneyRequestList>('/api/student/withdrawals'),
    ]);

    if (profileResult.status === 'fulfilled') {
      setData(profileResult.value);
    } else {
      setError(
        profileResult.reason instanceof ApiClientError
          ? profileResult.reason.message
          : 'Imeshindikana kupakia wasifu wako.',
      );
    }
    if (ordersResult.status === 'fulfilled') {
      setPendingOrders(ordersResult.value.orders.filter((order) => order.status === 'PENDING'));
    }
    setMoney({
      refunds:
        refundsResult.status === 'fulfilled'
          ? countPendingRequests(refundsResult.value)
          : null,
      withdrawals:
        withdrawalsResult.status === 'fulfilled'
          ? countPendingRequests(withdrawalsResult.value)
          : null,
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !data) return <ProfileSkeleton />;

  if (!data) {
    return (
      <div className="space-y-5">
        <PageHeader
          eyebrow="Akaunti"
          title="Wasifu wangu"
          description="Taarifa zako za chuo, wallet na usalama."
        />
        <ErrorState message={error ?? 'Imeshindikana kupakia wasifu.'} onRetry={() => void load()} />
      </div>
    );
  }

  const { student, university, wallet, stats } = data;
  const googleEmail = identity.email ? maskEmail(identity.email) : null;
  const googleState = identity.googleLinked
    ? { label: 'Google session', variant: 'success' as const, dot: true }
    : identity.email
      ? { label: 'Google haijaunganishwa', variant: 'warning' as const, dot: true }
      : { label: 'Google haijawekwa', variant: 'neutral' as const, dot: false };

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Akaunti • Profile"
        title="Wasifu wangu"
        description="Taarifa zako za chuo, wallet, coupons na usalama wa kikao."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} loading={loading}>
            <RefreshCcw aria-hidden />
            Sasisha
          </Button>
        }
      />

      {/* Identity */}
      <Card className="overflow-hidden p-0">
        <div className="relative overflow-hidden bg-navy px-5 pb-5 pt-5 text-white">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.1)_0.7px,transparent_0.7px)] bg-[length:18px_18px] opacity-60" />
          <div className="relative flex items-start gap-3">
            <Avatar name={student.name} size="lg" className="ring-2 ring-white/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold tracking-tight text-white">
                {student.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-300">
                {student.studentId} • {university.code}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="border-white/20 bg-white/10 text-white">
                  Mwaka {student.year}
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
              {googleEmail ?? 'Hakuna email iliyounganishwa'}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {student.phone}
            </span>
          </div>
        </div>
      </Card>

      {/* Wallet */}
      <section className="balance-card p-5" aria-label="Salio la wallet">
        <div className="relative z-10 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-100/80">
              <Wallet className="h-3.5 w-3.5" aria-hidden />
              Salio lako
            </p>
            <p className="mt-2 text-[2rem] font-semibold leading-none tracking-tight tabular">
              {formatTZS(wallet.balance)}
            </p>
            <p className="mt-2 text-[11px] text-emerald-100/70">{wallet.currency} wallet</p>
          </div>
          <span className="shrink-0 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-100">
            {university.code}
          </span>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/70">
              Matumizi yote
            </p>
            <p className="text-sm font-semibold tabular text-white">
              {formatTZS(stats.totalSpent)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/70">
              Miamala
            </p>
            <p className="text-sm font-semibold tabular text-white">{stats.transactionsCount}</p>
          </div>
        </div>
        <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
          <Button
            asChild
            className="w-full bg-white px-3 text-sm text-primary-800 hover:bg-emerald-50"
          >
            <Link href="/student/topup">
              <PlusCircle aria-hidden />
              Weka pesa
            </Link>
          </Button>
          <Button
            asChild
            variant="secondary"
            className="w-full border border-white/20 bg-white/10 px-3 text-sm text-white shadow-none hover:bg-white/20"
          >
            <Link href="/student/pay">
              <ScanLine aria-hidden />
              Scan
            </Link>
          </Button>
        </div>
      </section>

      {/* Stats that link to the next action */}
      <div className="grid grid-cols-2 gap-2">
        <StatLink
          href="/student/pay"
          label="Coupons"
          value={String(pendingOrders.length)}
          hint="Zinasubiri vendor"
          icon={Ticket}
          tone="bg-amber-50 text-amber-600"
        />
        <StatLink
          href="/student/refunds"
          label="Refunds"
          value={money.refunds === null ? '—' : String(money.refunds)}
          hint="Order refunds • admin"
          icon={RotateCcw}
          tone="bg-violet-50 text-violet-600"
        />
        <StatLink
          href="/student/withdrawals"
          label="Cash out"
          value={money.withdrawals === null ? '—' : String(money.withdrawals)}
          hint="Withdrawals • admin"
          icon={Banknote}
          tone="bg-sky-50 text-sky-600"
        />
        <StatLink
          href="/student/history"
          label="Milo"
          value={String(stats.mealsCount)}
          hint="Zilizolipwa"
          icon={UtensilsCrossed}
          tone="bg-rose-50 text-rose-600"
        />
      </div>

      {/* Quick links */}
      <Card className="p-3">
        <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-400">
          Njia za haraka • Shortcuts
        </p>
        <div className="divide-y divide-slate-100">
          <ActionRow
            href="/student/pay"
            icon={Ticket}
            title="Coupons zangu"
            description="Onyesha coupon kwa vendor au ghairi order inayosubiri"
            tone="bg-amber-50 text-amber-600"
          />
          <ActionRow
            href="/student/history"
            icon={History}
            title="Historia ya wallet"
            description="Top-ups, malipo ya chakula na refunds zote"
            tone="bg-sky-50 text-sky-600"
          />
          <ActionRow
            href="/student/refunds"
            icon={RotateCcw}
            title="Refunds"
            description="Order refunds tu: omba refund ya order iliyothibitishwa"
            tone="bg-violet-50 text-violet-600"
          />
          <ActionRow
            href="/student/withdrawals"
            icon={Banknote}
            title="Cash out • Withdrawals"
            description="Toa salio la wallet kwenda mobile money (admin huapprove)"
            tone="bg-emerald-50 text-emerald-600"
          />
        </div>
      </Card>

      {/* Campus details */}
      <Card className="p-5">
        <p className="text-sm font-semibold text-slate-900">Taarifa za chuo</p>
        <div className="mt-2 divide-y divide-slate-100">
          <DetailRow icon={Hash} label="Namba ya mwanafunzi" value={student.studentId} />
          <DetailRow
            icon={Building2}
            label="Chuo"
            value={`${university.name}${university.city ? ` • ${university.city}` : ''}`}
          />
          <DetailRow icon={BookOpen} label="Kozi" value={student.course} />
          <DetailRow icon={GraduationCap} label="Mwaka wa masomo" value={`Mwaka ${student.year}`} />
          <DetailRow icon={Phone} label="Simu" value={student.phone} />
          <DetailRow
            icon={CalendarDays}
            label="Mwanachama tangu"
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
            <p className="text-sm font-semibold text-slate-900">Kikao chako • Your session</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Kupon inatumia <span className="font-semibold text-slate-700">Google Sign-In</span>.
              Huhitaji OTP wala password — Google ndiyo inathibitisha akaunti yako.
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
              Hali
            </span>
            <Badge variant={googleState.variant} dot={googleState.dot}>
              {identity.googleLinked ? 'Imeunganishwa' : 'Haijaunganishwa'}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-slate-500">
              <Clock3 className="h-3.5 w-3.5" aria-hidden />
              Kuingia kwa mwisho
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
            ? 'Umeingia kwa Google kwenye kifaa hiki. Ukitoka, utahitaji kuchagua akaunti yako ya Google tena.'
            : identity.email
              ? 'Tumia email hii ya chuo kuingia na Google. Kama Google yako ina email tofauti, mwone admin wa chuo ili waiunganishe.'
              : 'Hakuna email ya Google iliyounganishwa. Mwone admin wa chuo ili waiunganishe kabla ya kujaribu kuingia na Google.'}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Usitoe coupon code yako kwa mtu yeyote isipokuwa vendor wa counter unayochukua chakula.
          Kupon haitoi pesa kwenye wallet bila wewe kuomba.
        </p>

        <Button
          variant="outline"
          className="mt-3 h-11 w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          onClick={() => void signOut()}
        >
          <LogOut aria-hidden />
          Toka • Sign out
        </Button>
      </Card>

      {/* PWA */}
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
            <Smartphone className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">Sakinisha Kupon kwenye simu</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Kupon ni Progressive Web App (PWA): unaiongeza kwenye home screen na kuitumia kama
              app ya kawaida — bila Play Store.
            </p>
          </div>
        </div>
        <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
          <p>
            <span className="font-semibold text-slate-800">Android (Chrome):</span> menyu ⋮ → “Add
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
            Salama
          </Badge>
          <Badge variant="neutral">Scan &amp; order</Badge>
          <Badge variant="neutral">Bila OTP</Badge>
        </div>
      </Card>
    </div>
  );
}
