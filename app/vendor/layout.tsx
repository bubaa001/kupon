import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requirePageUser } from '@/lib/auth';
import { VendorShell } from '@/components/layout/vendor-shell';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: {
    default: 'Vendor terminal',
    template: '%s • Vendor • Kupon',
  },
  description:
    'Run your campus cafeteria on Kupon: manage orders, verify meal coupons and review sales.',
};

/**
 * Server guard for every /vendor page. The shell receives a fresh vendor
 * snapshot (including pending balance) on each navigation.
 */
export default async function VendorLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePageUser(['VENDOR']);
  const vendor = user.vendor;

  if (!vendor) {
    redirect('/login');
  }
  if (vendor.status === 'PENDING') {
    redirect('/vendor-pending');
  }

  return (
    <VendorShell
      user={{
        name: user.name,
        vendorName: vendor.name,
        vendorCode: vendor.code,
        universityName: user.university?.name ?? 'Kupon',
        universityCode: user.university?.code ?? '',
        pendingBalance: vendor.pendingBalance,
      }}
    >
      {children}
    </VendorShell>
  );
}
