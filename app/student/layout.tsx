import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { requirePageUser } from '@/lib/auth';
import { StudentShell } from '@/components/layout/student-shell';

export const metadata: Metadata = { title: 'Student | Kupon' };

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['STUDENT']);

  if (!user.student || !user.university) {
    redirect('/login');
  }

  return (
    <StudentShell
      user={{
        name: user.name,
        phone: user.phone,
        studentId: user.student.studentId,
        universityName: user.university.name,
        universityCode: user.university.code,
      }}
    >
      {children}
    </StudentShell>
  );
}
