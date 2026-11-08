import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Store } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getAuthUser, roleHome } from '@/lib/auth';
import { VendorAccessForm } from './vendor-access-form';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Vendor sign in',
  description: 'Sign in to Kupon or apply to register a campus cafeteria.',
};

export default async function VendorLoginPage() {
  const user = await getAuthUser();
  if (user) redirect(roleHome(user.role));

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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card sm:p-7">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-800">
            <Store className="h-3.5 w-3.5" />
            Cafeteria owner
          </span>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-navy sm:text-3xl">
            Vendor sign in
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Use your phone and password, or continue with Google. New owners can apply with Google;
            your request must be approved before you can open the cafeteria dashboard.
          </p>
          <div className="mt-6">
            <VendorAccessForm />
          </div>
        </div>
        <p className="mt-5 text-center text-xs text-slate-500">
          Buying a meal?{' '}
          <Link href="/login" className="font-semibold text-primary-700 hover:underline">
            Student sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
