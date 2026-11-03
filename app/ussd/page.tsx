import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { env } from '@/lib/env';
import { USSD_ENABLED } from '@/lib/features';
import { prisma } from '@/lib/db';
import { UssdSimulator } from './ussd-simulator';

export const metadata: Metadata = {
  title: 'USSD simulator',
  description:
    'Try the Kupon USSD fallback on a feature phone simulator: check a wallet balance, pay a campus vendor or top up with mobile money.',
};

export const dynamic = 'force-dynamic';

export default async function UssdPage() {
  // Offline payments are paused for now. The simulator and API stay in the
  // codebase behind NEXT_PUBLIC_USSD_ENABLED, but the route is not reachable.
  if (!USSD_ENABLED) notFound();

  const university = await prisma.university.findUnique({
    where: { code: 'UDSM' },
    select: { id: true, name: true, code: true },
  });

  const [student, vendors] = university
    ? await Promise.all([
        prisma.studentProfile.findFirst({
          where: { universityId: university.id },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { phone: true, name: true } } },
        }),
        prisma.vendor.findMany({
          where: { universityId: university.id, status: 'ACTIVE' },
          orderBy: { name: 'asc' },
          select: { code: true, name: true },
        }),
      ])
    : [null, []];

  return (
    <main className="min-h-dvh bg-canvas">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="inline-flex min-h-[44px] items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              <span className="hidden sm:inline">Back to home</span>
              <span className="sm:hidden">Home</span>
            </Link>
            <Button asChild size="sm" className="h-10 px-4 text-sm">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 lg:pt-10">
        <div className="max-w-2xl">
          <p className="eyebrow">Feature phone simulator</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-navy sm:text-4xl">
            The wallet on {env.USSD_SHORTCODE}.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-600 sm:text-base">
            {student
              ? `Dial in with the seeded student number ${student.user.name}, then check the balance, pay a canteen or top up.`
              : 'Dial in with a seeded student number, then check the balance, pay a canteen or top up.'}{' '}
            Every action calls the live{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-slate-700">
              /api/ussd
            </code>{' '}
            route and reads/writes the database.
          </p>
        </div>

        <UssdSimulator
          demoPhone={student?.user.phone ?? ''}
          shortCode={env.USSD_SHORTCODE}
          vendors={vendors.map((vendor) => ({
            code: vendor.code,
            name: vendor.name,
          }))}
        />

        <p className="mt-8 border-t border-slate-200 pt-5 text-[11px] leading-relaxed text-slate-400">
          This is a browser simulation of a telco USSD session. A real deployment receives the
          subscriber MSISDN from the gateway, never from the handset. No telco SMS is sent; the
          messages in the inbox are the confirmation texts the simulation API returns.
        </p>
      </section>
    </main>
  );
}
