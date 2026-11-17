'use client';

import { ClipboardCheck, UtensilsCrossed } from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';

export function StaffShell({
  name,
  vendorName,
  vendorCode,
  children,
}: {
  name: string;
  vendorName: string;
  vendorCode: string;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      homeHref="/staff"
      roleLabel="Cafeteria staff"
      orgLabel={`${vendorName} · ${vendorCode}`}
      groups={[
        {
          items: [
            {
              href: '/staff',
              label: 'Orders & coupons',
              shortLabel: 'Orders',
              icon: ClipboardCheck,
              primary: true,
            },
            { href: '/staff/menu', label: 'Today’s menu', shortLabel: 'Menu', icon: UtensilsCrossed },
          ],
        },
      ]}
      mobileTabs={['/staff', '/staff/menu']}
      user={{ name, detail: vendorName }}
      signOutTo="/staff/login"
      width="narrow"
    >
      {children}
    </AppShell>
  );
}
