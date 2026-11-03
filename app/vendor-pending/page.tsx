import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Clock3, Mail, ShieldCheck, Store } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getAuthUser, roleHome } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = {
  title: 'Vendor approval pending',
  description: 'Your Kupon vendor request is waiting for university admin approval.',
};

export const dynamic = 'force-dynamic';

export default async function VendorPendingPage() {
  const user = await getAuthUser();
  if (!user) redirect('/login?role=vendor');
  if (user.role !== 'VENDOR' || !user.vendor) redirect(roleHome(user.role));
  if (user.vendor.status === 'ACTIVE') redirect('/vendor');
  if (user.vendor.status === 'SUSPENDED') redirect('/login?error=google_vendor_suspended&role=vendor');

  const [vendor, account] = await Promise.all([
    prisma.vendor.findUnique({
      where: { id: user.vendor.id },
      select: {
        name: true,
        code: true,
        description: true,
        status: true,
        createdAt: true,
        university: { select: { name: true, code: true, city: true } },
      },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { email: true, phone: true, name: true },
    }),
  ]);
  if (!vendor) redirect('/login?role=vendor');

  return (
    <main className="min-h-screen bg-[#f7faf8]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-6 sm:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Badge variant="warning" dot>
            Pending review
          </Badge>
        </header>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)]">
            <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_20%_0%,rgba(251,191,36,0.16),transparent_50%)] p-6 sm:p-8">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
                <Clock3 className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Your vendor request is in review
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500">
                {vendor.university.name} has received your application for{' '}
                <span className="font-semibold text-slate-800">{vendor.name}</span>. Approval usually
                takes less than a day. You will be able to open the order desk as soon as an admin
                approves it.
              </p>
            </div>

            <div className="space-y-5 p-6 sm:p-8">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Business
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">{vendor.name}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Campus
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-slate-800">
                    {vendor.university.code}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Request ID
                  </p>
                  <p className="mt-1 truncate font-mono text-xs font-semibold text-slate-800">
                    {vendor.code}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <Store className="h-4 w-4 text-primary-600" aria-hidden />
                  {vendor.description}
                </p>
              </div>

              <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-[11px] text-slate-500 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                  Google verified: {account?.email ?? '—'}
                </p>
                <p className="flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
                  Contact: {account?.phone ?? '—'}
                </p>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-500">
                Need to change something? Ask the {vendor.university.name} admin to review the
                request or reject it so you can apply again. Your session stays active while the
                request is pending.
              </p>

              <div className="flex flex-wrap gap-2">
                <Button asChild>
                  <a href="/vendor-pending">Refresh status</a>
                </Button>
                <SignOutButton />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
