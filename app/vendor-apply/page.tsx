import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { VendorApplyForm } from './vendor-apply-form';

export const metadata: Metadata = {
  title: 'Apply as a vendor',
  description: 'Apply to register your cafeteria on Kupon from any university or campus.',
};

export const dynamic = 'force-dynamic';

export default function VendorApplyPage() {
  return (
    <main className="min-h-dvh bg-[#f7faf8] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/vendor/login"
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Vendor sign in
          </Link>
        </header>

        <div className="mx-auto w-full max-w-xl flex-1 py-8 sm:py-12">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-700">
              Cafeteria registration
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Apply to sell on Kupon
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Submit your business and campus details first. The platform team will review your
              registration documents, your authority to represent the business, and the cafeteria
              location. Kupon administrators add institutions that are not already listed. Google
              sign-in comes after approval.
            </p>
          </div>
          <VendorApplyForm />
        </div>
      </div>
    </main>
  );
}
