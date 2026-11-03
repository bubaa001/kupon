import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  HelpCircle,
  Phone,
  QrCode,
  ShieldCheck,
  Store,
  UserRound,
  Wallet,
} from 'lucide-react';
import { requirePageUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { formatTZS } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account & settings' };

export default async function VendorProfilePage() {
  const user = await requirePageUser(['VENDOR']);
  const vendor = user.vendor;
  if (!vendor || !user.university) redirect('/login?role=vendor');

  const record = await prisma.vendor.findUnique({
    where: { id: vendor.id },
    select: { description: true, settlementAccount: true },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Vendor account"
        title="Account & settings"
        description="Your business details, sign-in session and support shortcuts in one place."
        backHref="/vendor"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle>Business profile</CardTitle>
                <CardDescription>The name students see when they scan your QR.</CardDescription>
              </div>
              <StatusBadge status={vendor.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Store className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{vendor.name}</p>
                <p className="font-mono text-[11px] text-slate-500">{vendor.code}</p>
              </div>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  University
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-slate-800">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  {user.university.name}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                  Settlement account
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-slate-800">
                  <Wallet className="h-3.5 w-3.5 text-slate-400" />
                  {record?.settlementAccount || 'Pending bank details'}
                </p>
              </div>
            </div>
            {record?.description ? (
              <p className="text-sm leading-relaxed text-slate-500">{record.description}</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Owner &amp; sign-in</CardTitle>
            <CardDescription>This account is protected by the verified Google identity.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                <UserRound className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs leading-relaxed text-emerald-900">
              <p className="flex items-center gap-1.5 font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Google sign-in active
              </p>
              <p className="mt-1 text-emerald-800/80">
                Signing out returns you to the vendor login tab. Use the same Google email to get
                back into this account.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <SignOutButton destination="/login?role=vendor" />
              <Button asChild variant="outline">
                <Link href="/vendor#counter-qr">
                  <QrCode className="h-4 w-4" />
                  Menu QR
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BadgeCheck className="h-4 w-4 text-emerald-600" />
              Settlement balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tracking-tight text-slate-900">
              {formatTZS(vendor.pendingBalance)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Pending settlement to your account.</p>
            <Link
              href="/vendor/settlement"
              className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
            >
              Open settlement <ArrowRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HelpCircle className="h-4 w-4 text-slate-500" />
              Need help?
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-slate-500">
              Questions about your till, settlement or student coupons? Contact Kupon support.
            </p>
            <Button asChild variant="outline" className="mt-3">
              <a href="mailto:support@kupon.co.tz?subject=Vendor%20support">Email support</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
