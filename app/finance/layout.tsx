import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requirePageUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Finance', template: '%s • Kupon Finance' },
};

export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['FINANCE'], '/staff/login');

  return (
    <DashboardShell
      kind="finance"
      user={{
        name: user.name,
        phone: user.phone,
        roleLabel: ROLE_LABEL.FINANCE,
      }}
    >
      {children}
    </DashboardShell>
  );
}
