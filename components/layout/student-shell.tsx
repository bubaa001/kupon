'use client';

import { CircleDollarSign, Clock3, Home, ScanLine, UserRound } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { LanguageProvider, LanguageToggle, useT } from '@/lib/i18n';

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
    <LanguageProvider>
      <BuyerShell user={user}>{children}</BuyerShell>
    </LanguageProvider>
  );
}

function BuyerShell({ user, children }: { user: StudentShellUser; children: React.ReactNode }) {
  const { t } = useT();
  const guest = user.studentId.startsWith('GUEST-');
  return (
    <AppShell
      homeHref="/student"
      roleLabel={guest ? t('role.guest') : t('role.student')}
      orgLabel={user.universityName}
      groups={[
        {
          items: [
            { href: '/student', label: t('nav.home'), icon: Home },
            {
              href: '/student/pay',
              label: t('nav.order'),
              shortLabel: t('nav.orderShort'),
              icon: ScanLine,
              primary: true,
            },
            {
              href: '/student/history',
              label: t('nav.history'),
              shortLabel: t('nav.historyShort'),
              icon: Clock3,
            },
            {
              href: '/student/credit-requests',
              label: t('nav.credit'),
              shortLabel: t('nav.creditShort'),
              icon: CircleDollarSign,
            },
            { href: '/student/profile', label: t('nav.profile'), icon: UserRound },
          ],
        },
      ]}
      mobileTabs={['/student', '/student/pay', '/student/history', '/student/credit-requests']}
      user={{ name: user.name, detail: guest ? user.universityName : user.studentId }}
      signOutTo="/login"
      sheetExtra={<LanguageToggle />}
      width="narrow"
    >
      {children}
    </AppShell>
  );
}
