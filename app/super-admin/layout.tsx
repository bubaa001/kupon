import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requirePageUser } from '@/lib/auth';

export const metadata: Metadata = {
  title: {
    default: 'Platform control',
    template: '%s · Kupon platform',
  },
};

/**
 * Super-admin (Bubaa Comp) shell. The guard runs on the server for every
 * /super-admin route; a tenant admin or student who lands here is redirected to
 * their own home instead of seeing any platform data.
 */
export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['SUPER_ADMIN'], '/staff/login');

  return (
    <DashboardShell
      kind="super"
      user={{
        name: user.name,
        phone: user.phone,
        roleLabel: 'Platform admin',
        universityName: 'Bubaa Comp',
        universityCode: 'PLATFORM',
      }}
    >
      {children}
    </DashboardShell>
  );
}
