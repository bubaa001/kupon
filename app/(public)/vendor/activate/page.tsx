import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { prisma } from '@/lib/db';
import {
  GOOGLE_VENDOR_ACTIVATION_COOKIE,
  verifyGoogleVendorActivationTicket,
} from '@/lib/google-signup';
import { VendorActivationForm } from './vendor-activation-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Activate your vendor account',
  description: 'Finish Google-verified account setup after platform approval.',
};

export default async function VendorActivatePage() {
  const ticket = await verifyGoogleVendorActivationTicket(
    cookies().get(GOOGLE_VENDOR_ACTIVATION_COOKIE)?.value,
  );
  if (!ticket) redirect('/vendor/login?error=google_vendor_activation_expired');

  const application = await prisma.vendorApplication.findFirst({
    where: {
      id: ticket.applicationId,
      email: ticket.email,
      status: 'APPROVED',
      userId: null,
    },
    select: {
      ownerName: true,
      phone: true,
      businessName: true,
      university: { select: { name: true, status: true } },
    },
  });
  if (!application || application.university?.status !== 'ACTIVE') {
    redirect('/vendor/login?error=google_vendor_not_approved');
  }

  return (
    <main className="min-h-dvh bg-canvas px-4 py-8 sm:px-6">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-6 flex items-center justify-between">
          <Logo />
          <Link
            href="/vendor/login"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Vendor sign in
          </Link>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-700">
            Application approved
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Finish setting up your account
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Google verified {ticket.email}. You are setting the password for your{' '}
            {application.businessName} vendor account at {application.university.name}. You choose
            this password; it will be used with the owner phone number on your application (
            {application.phone}) for manual sign-in.
          </p>
          <div className="mt-6">
            <VendorActivationForm />
          </div>
        </div>
      </div>
    </main>
  );
}
