import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { AcceptInviteForm } from './accept-invite-form';

export const metadata: Metadata = {
  title: 'Accept team invitation',
  description: 'Set up Kupon access using your cafeteria team invitation.',
  robots: { index: false, follow: false },
};

export default async function StaffInvitePage({ params }: { params: { token: string } }) {
  return (
    <main className="relative min-h-dvh overflow-hidden bg-navy px-4 py-8 sm:px-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.2),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(45,212,191,0.12),transparent_40%)]"
      />
      <div className="relative mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center justify-between">
          <Logo variant="light" />
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kupon home
          </Link>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-7">
          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-800">
              <ShieldCheck className="h-3.5 w-3.5" />
              Cafeteria invitation
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-navy">
              Set up your Kupon access
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Confirm the invitation details, then choose a password. You can also use Google with
              the invited email when signing in.
            </p>
          </div>
          <AcceptInviteForm token={params.token} />
        </div>
      </div>
    </main>
  );
}
