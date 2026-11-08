import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { SetupForm } from './setup-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Create platform owner',
  robots: { index: false, follow: false },
};

export default async function FirstOwnerPage() {
  if ((await prisma.user.count({ where: { role: 'SUPER_ADMIN' } })) !== 0) {
    redirect('/staff/login');
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kupon home
          </Link>
        </div>
        <Card className="p-5 sm:p-7">
          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              One-time setup
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
              Create the platform owner
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              This account reviews cafeteria applications and manages platform access. Setup closes
              as soon as the first account is created.
            </p>
          </div>
          {!env.SUPER_ADMIN_SETUP_TOKEN ? (
            <Alert variant="warning" className="mb-4">
              Configure a random `SUPER_ADMIN_SETUP_TOKEN` of at least 32 characters in the server
              environment before creating the first owner.
            </Alert>
          ) : null}
          <SetupForm />
        </Card>
      </div>
    </main>
  );
}
