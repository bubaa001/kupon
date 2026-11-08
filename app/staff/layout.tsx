import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { StaffShell } from '@/components/layout/staff-shell';
import { requirePageUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: { default: 'Cafeteria staff', template: '%s • Staff • Kupon' },
  robots: { index: false, follow: false },
};

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['STAFF'], '/staff/login');
  if (!user.managedVendor) redirect('/staff/login');

  return (
    <StaffShell
      name={user.name}
      vendorName={user.managedVendor.name}
      vendorCode={user.managedVendor.code}
    >
      {children}
    </StaffShell>
  );
}
