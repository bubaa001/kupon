import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getAuthUser, roleHome } from '@/lib/auth';
import { LoginForm } from '@/app/login/login-form';

export const metadata: Metadata = {
  title: 'Staff access',
  description: 'Secure sign-in for cafeteria staff, Finance and platform administrators.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Separate staff entrance.
 *
 * The public /login page is intentionally student/vendor only. Staff accounts
 * use this dedicated sign-in and do not appear in the public role switcher.
 */
export default async function StaffLoginPage() {
  const sessionUser = await getAuthUser();
  if (sessionUser) redirect(roleHome(sessionUser.role));

  return (
    <main className="relative min-h-screen overflow-hidden bg-navy">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(16,185,129,0.2),transparent_45%),radial-gradient(circle_at_80%_100%,rgba(45,212,191,0.12),transparent_40%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <Logo variant="light" />
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-medium text-slate-300 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kupon home
          </Link>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white p-5 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] sm:p-7">
          <div className="mb-5">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-700">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
              Staff access only
            </span>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-navy sm:text-3xl">
              Staff sign in
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">
              For cafeteria teams, Finance and platform administrators. Student and vendor accounts
              should use their regular sign-in.
            </p>
          </div>

          <LoginForm initialRole="staff" audience="staff" />
        </div>

        <div className="mt-5 flex flex-col items-center gap-2 text-center">
          <Link
            href="/login"
            className="text-xs font-semibold text-slate-300 underline-offset-4 hover:text-white hover:underline"
          >
            Student or vendor? Go to regular sign-in
          </Link>
          <p className="text-[10px] leading-relaxed text-slate-500">
            Staff sign-in is not exposed on the public landing page. Share this URL only with
            authorised cafeteria or platform team members.
          </p>
        </div>
      </div>
    </main>
  );
}
