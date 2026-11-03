import type { Metadata } from 'next';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requirePageUser } from '@/lib/auth';
import { ROLE_LABEL } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'University admin',
    template: '%s • Kupon admin',
  },
};

/**
 * Server-side guard for the whole admin area. An ADMIN session is rehydrated
 * from the database on every request, so a suspended account is bounced even
 * if its JWT is still valid. The API routes repeat the same check — the layout
 * guard is UX, not the security boundary.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['ADMIN'], '/staff/login');

  return (
    <DashboardShell
      kind="admin"
      user={{
        name: user.name,
        phone: user.phone,
        roleLabel: ROLE_LABEL[user.role],
        universityName: user.university?.name ?? 'University',
        universityCode: user.university?.code ?? undefined,
      }}
    >
      {children}
    </DashboardShell>
  );
}
