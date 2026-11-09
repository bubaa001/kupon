import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, Smartphone } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getAuthUser, roleHome } from '@/lib/auth';
import { LoginForm, type LoginRole } from './login-form';

export const metadata: Metadata = {
  title: 'Student sign in',
  description:
    'Students sign in with Google to order from a cafeteria.',
};

export const dynamic = 'force-dynamic';

type LoginPageProps = {
  searchParams?: { [key: string]: string | string[] | undefined };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  // Already have a valid session: skip the form and land on the role home.
  const sessionUser = await getAuthUser();
  if (sessionUser) redirect(roleHome(sessionUser.role));

  const requestedRole = Array.isArray(searchParams?.role)
    ? searchParams?.role[0]
    : searchParams?.role;
  // Keep the public sign-in focused on students. Other account types have
  // dedicated entry points with the correct controls for their role.
  if (requestedRole === 'staff') redirect('/staff/login');
  if (requestedRole === 'vendor') redirect('/vendor/login');
  const initialRole: LoginRole = 'student';

  return (
    <main className="min-h-dvh bg-canvas">
      <div className="lg:grid lg:min-h-dvh lg:grid-cols-[1.03fr_0.97fr]">
        <aside className="relative hidden overflow-hidden bg-navy px-10 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 [background-image:radial-gradient(rgba(255,255,255,0.09)_0.8px,transparent_0.8px)] [background-size:20px_20px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 top-10 h-80 w-80 rounded-full bg-primary-500/20 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-primary-400/10 blur-3xl"
          />

          <div className="relative">
            <Logo variant="light" />
            <p className="mt-16 max-w-md text-4xl font-semibold leading-[1.03] tracking-[-0.04em] xl:text-[2.9rem]">
              Clear orders. Trusted records.
            </p>
            <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-300">
              Browse a cafeteria menu, place an order, and keep every coupon and transaction
              traceable without a campus wallet.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-slate-300">
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                Order directly from an approved cafeteria.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                Coupons appear only after a payment status is recorded.
              </li>
              <li className="flex gap-2.5">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary-300" strokeWidth={2} />
                A double-entry ledger the bursar can audit line by line.
              </li>
            </ul>
          </div>

          <div className="relative mt-12 max-w-md rounded-xl border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Smartphone className="h-4 w-4 text-primary-300" aria-hidden />
              A clearer flow from menu to meal
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {[
                ['Choose', 'Browse what is available today.'],
                ['Pay', 'Payment status is recorded.'],
                ['Collect', 'Show the verified meal coupon.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-lg bg-white/[0.04] p-2.5">
                  <p className="text-xs font-semibold text-primary-200">{title}</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-400">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="relative mt-10 text-xs text-slate-500">
            Kupon test environment · payment events are simulated
          </p>
        </aside>

        <section className="flex min-h-dvh flex-col px-4 pb-8 pt-5 sm:px-6 lg:px-10 lg:pb-10 lg:pt-8">
          <div className="mx-auto flex w-full max-w-md items-center justify-between lg:max-w-lg">
            <span className="lg:hidden">
              <Logo size="sm" />
            </span>
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 lg:inline-flex"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={2} />
              Back to home
            </Link>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-7 lg:max-w-lg lg:py-10">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card sm:p-7">
              <div className="mb-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary-600">
                  Kupon account
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-navy sm:text-3xl">
                  Student sign in
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Sign in with Google to browse cafeteria menus, place orders, and keep your meal
                  coupons together.
                </p>
              </div>

              <LoginForm initialRole={initialRole} audience="student" />
              <p className="mt-5 text-center text-sm text-slate-500">
                Run a cafeteria?{' '}
                <Link
                  href="/vendor/login"
                  className="font-semibold text-primary-700 hover:underline"
                >
                  Sign in or apply as a vendor
                </Link>
              </p>
            </div>

            <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-400">
              Only payment status is simulated; no real money moves. Students sign in with Google
              while SMS login is unavailable.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
