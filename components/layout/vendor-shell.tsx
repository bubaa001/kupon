'use client';

import Link from 'next/link';
import {
  BadgeDollarSign,
  ClipboardCheck,
  Home,
  LifeBuoy,
  QrCode,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { AppShell } from '@/components/layout/app-shell';
import { formatTZS } from '@/lib/utils';

export type VendorShellUser = {
  name: string;
  vendorName: string;
  vendorCode: string;
  universityName: string;
  universityCode: string;
  pendingBalance: number;
};

export function VendorShell({
  user,
  children,
}: {
  user: VendorShellUser;
  children: React.ReactNode;
}) {
  return (
    <AppShell
      homeHref="/vendor"
      roleLabel="Cafeteria owner"
      orgLabel={`${user.vendorName} · ${user.universityName}`}
      groups={[
        {
          title: 'Service',
          items: [
            { href: '/vendor', label: 'Today', icon: Home },
            {
              href: '/vendor/scan',
              label: 'Orders & coupons',
              shortLabel: 'Orders',
              icon: ClipboardCheck,
              primary: true,
            },
            { href: '/vendor/menu', label: 'Menu', icon: UtensilsCrossed },
          ],
        },
        {
          title: 'Money',
          items: [
            { href: '/vendor/sales', label: 'Sales', icon: BadgeDollarSign },
            { href: '/vendor/settlement', label: 'Settlement', icon: Wallet },
            { href: '/vendor/credit-requests', label: 'Credit cases', icon: LifeBuoy },
          ],
        },
        {
          title: 'Cafeteria',
          items: [{ href: '/vendor/team', label: 'Team', icon: UsersRound }],
        },
      ]}
      mobileTabs={['/vendor', '/vendor/scan', '/vendor/menu', '/vendor/sales']}
      user={{ name: user.name, detail: user.vendorCode }}
      signOutTo="/login?role=vendor"
      accountLinks={[
        { href: '/vendor/profile', label: 'Profile & settings', icon: UserRound },
        { href: '/vendor#counter-qr', label: 'Counter QR', icon: QrCode },
        {
          href: 'mailto:support@kupon.co.tz?subject=Vendor%20support',
          label: 'Help & support',
          icon: LifeBuoy,
        },
      ]}
      sidebarExtra={
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">
            Pending settlement
          </p>
          <p className="mt-1.5 text-xl font-medium tracking-[-0.03em] text-white tabular">
            {formatTZS(user.pendingBalance)}
          </p>
          <Link
            href="/vendor/settlement"
            className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-gold px-3 text-xs font-semibold text-navy transition-colors hover:bg-gold-200"
          >
            View settlement
          </Link>
        </div>
      }
    >
      {children}
    </AppShell>
  );
}
