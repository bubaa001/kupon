'use client';

import { CircleDollarSign, Clock3, Home, ScanLine, UserRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export type StudentShellUser = {
  name: string;
  phone: string;
  studentId: string;
  universityName: string;
  universityCode: string;
};

export function StudentShell({
  user,
  children,
}: {
  user: StudentShellUser;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      homeHref="/student"
      roleLabel="Student"
      orgLabel={user.universityName}
      groups={[
        {
          items: [
            { href: '/student', label: 'Home', icon: Home },
            {
              href: '/student/pay',
              label: 'Scan & order',
              shortLabel: 'Order',
              icon: ScanLine,
              primary: true,
            },
            { href: '/student/history', label: 'Order history', shortLabel: 'History', icon: Clock3 },
            {
              href: '/student/credit-requests',
              label: 'Credit & help',
              shortLabel: 'Credit',
              icon: CircleDollarSign,
            },
            { href: '/student/profile', label: 'Profile', icon: UserRound },
          ],
        },
      ]}
      mobileTabs={['/student', '/student/pay', '/student/history', '/student/credit-requests']}
      user={{ name: user.name, detail: user.studentId }}
      signOutTo="/login"
      width="narrow"
    >
      {children}
    </AppShell>
  );
}
