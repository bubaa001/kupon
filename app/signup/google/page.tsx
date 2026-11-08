import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { getAuthUser, roleHome } from '@/lib/auth';
import { prisma } from '@/lib/db';
import {
  GOOGLE_SIGNUP_COOKIE,
  verifyGoogleSignupTicket,
} from '@/lib/google-signup';
import { GoogleSignupForm } from './signup-form';

export const metadata: Metadata = {
  title: 'Create your student account',
  description: 'Finish your Kupon student account with the Google account you just verified.',
};

export const dynamic = 'force-dynamic';

export default async function GoogleSignupPage() {
  const sessionUser = await getAuthUser();
  if (sessionUser) redirect(roleHome(sessionUser.role));

  const ticket = await verifyGoogleSignupTicket(cookies().get(GOOGLE_SIGNUP_COOKIE)?.value);
  if (!ticket) redirect('/login?error=google_signup_expired&role=student');

  const university = await prisma.university.findUnique({
    where: { id: ticket.universityId },
    select: { id: true, name: true, code: true, city: true, status: true },
  });
  if (!university || university.status !== 'ACTIVE') {
    redirect('/login?error=google_university&role=student');
  }

  return (
    <main className="min-h-screen bg-[#f7faf8]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/login?role=student"
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
                Google signup · No SMS needed
              </p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                Create your Kupon account
              </h1>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Your Google account is verified. Add your campus details once and start ordering
                from the cafeteria.
              </p>
            </div>

            <GoogleSignupForm
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
