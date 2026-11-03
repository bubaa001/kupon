import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requirePageUser } from '@/lib/auth';
import { ensureStudentWallet } from '@/lib/wallet';
import { StudentShell } from '@/components/layout/student-shell';
import { LiveBalance } from './_components/live-balance';

export const metadata: Metadata = { title: 'Student wallet' };

/**
 * Server-side role guard for the whole student area. The session is rehydrated
 * from the database on every request, so a deleted/suspended account loses access
 * immediately. The initial balance comes from the guard; `LiveBalance` then
 * keeps the shell in sync with the wallet API.
 */
export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['STUDENT']);

  if (!user.student || !user.university) {
    redirect('/login');
  }

  const { balance } = await ensureStudentWallet(user.student.id);

  return (
    <StudentShell
      user={{
        name: user.name,
        phone: user.phone,
        studentId: user.student.studentId,
        universityName: user.university.name,
        universityCode: user.university.code,
        balance,
      }}
    >
      <LiveBalance initialBalance={balance} />
      {children}
    </StudentShell>
  );
}
