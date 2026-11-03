import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getAuthUser, roleHome } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { GOOGLE_VENDOR_COOKIE, verifyGoogleVendorTicket } from '@/lib/google-signup';
import { VendorApplyForm } from './vendor-apply-form';

export const metadata: Metadata = {
  title: 'Apply as a vendor',
  description: 'Submit your campus cafeteria or food stall for Kupon vendor approval.',
};

export const dynamic = 'force-dynamic';

export default async function VendorApplyPage() {
  const sessionUser = await getAuthUser();
  if (sessionUser) {
    if (sessionUser.role === 'VENDOR') redirect('/vendor-pending');
    redirect(roleHome(sessionUser.role));
  }

  const ticket = await verifyGoogleVendorTicket(cookies().get(GOOGLE_VENDOR_COOKIE)?.value);
  if (!ticket) redirect('/login?error=google_vendor_expired&role=vendor');

  const university = await prisma.university.findUnique({
    where: { id: ticket.universityId },
    select: { id: true, name: true, code: true, city: true, status: true },
  });
  if (!university || university.status !== 'ACTIVE') {
    redirect('/login?error=google_university&role=vendor');
  }

  return (
    <main className="min-h-screen bg-[#f7faf8]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/login?role=vendor"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to sign in
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center py-8 lg:py-12">
          <div className="w-full max-w-lg">
            <div className="mb-5 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-700">
                Vendor application · Google verified
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Apply to sell on Kupon
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Tell the university about your food business. An admin reviews the request before
                your terminal goes live.
              </p>
            </div>

            <VendorApplyForm
              email={ticket.email}
              name={ticket.name}
              university={{ name: university.name, code: university.code, city: university.city }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
