'use client';

import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Store,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';
import { AppShell, type AppNavGroup } from '@/components/layout/app-shell';

export type DashboardKind = 'admin' | 'super' | 'finance';

export type DashboardUser = {
  name: string;
  phone: string;
  roleLabel: string;
  universityName?: string;
  universityCode?: string;
};

const ADMIN_NAV: AppNavGroup[] = [
  {
    title: 'Campus',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/transactions', label: 'Transactions', shortLabel: 'Activity', icon: ArrowLeftRight },
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'People',
    items: [
      { href: '/admin/vendors', label: 'Cafeterias', icon: Store },
      { href: '/admin/students', label: 'Students', icon: Users },
      { href: '/admin/team', label: 'Team accounts', icon: UserCog },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/admin/settings', label: 'Settings', icon: Settings }],
  },
];

const SUPER_NAV: AppNavGroup[] = [
  {
    title: 'Platform',
    items: [
      { href: '/super-admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/super-admin/tenants', label: 'Universities', icon: Building2 },
      { href: '/super-admin/revenue', label: 'Revenue', icon: TrendingUp },
      { href: '/super-admin/health', label: 'System health', shortLabel: 'Health', icon: Activity },
    ],
  },
  {
    title: 'Review queues',
    items: [
      {
        href: '/super-admin/vendor-applications',
        label: 'Cafeteria applications',
        shortLabel: 'Applications',
        icon: Store,
      },
      {
        href: '/super-admin/credit-requests',
        label: 'Credit approvals',
        shortLabel: 'Credits',
        icon: CircleDollarSign,
      },
    ],
  },
  {
    title: 'Access',
    items: [{ href: '/super-admin/finance-users', label: 'Team accounts', icon: UserCog }],
  },
];

const FINANCE_NAV: AppNavGroup[] = [
  {
    items: [
      { href: '/finance', label: 'Overview', icon: LayoutDashboard },
      { href: '/finance/test-payments', label: 'Payment activity', shortLabel: 'Payments', icon: ArrowLeftRight },
      { href: '/finance/requests', label: 'Credit & support', shortLabel: 'Cases', icon: LifeBuoy },
    ],
  },
];

const CONFIG: Record<DashboardKind, { home: string; groups: AppNavGroup[]; tabs: string[] }> = {
  admin: {
    home: '/admin',
    groups: ADMIN_NAV,
    tabs: ['/admin', '/admin/transactions', '/admin/vendors', '/admin/students'],
  },
  super: {
    home: '/super-admin',
    groups: SUPER_NAV,
    tabs: [
      '/super-admin',
      '/super-admin/tenants',
      '/super-admin/vendor-applications',
      '/super-admin/credit-requests',
    ],
  },
  finance: {
    home: '/finance',
    groups: FINANCE_NAV,
    tabs: ['/finance', '/finance/test-payments', '/finance/requests'],
  },
};

export function DashboardShell({
  kind,
  user,
  children,
}: {
  kind: DashboardKind;
  user: DashboardUser;
  children: React.ReactNode;
}) {
  const config = CONFIG[kind];
  const orgLabel = kind === 'super' ? 'All universities' : user.universityName;

  return (
    <AppShell
      homeHref={config.home}
      roleLabel={user.roleLabel}
      orgLabel={orgLabel}
      groups={config.groups}
      mobileTabs={config.tabs}
      user={{ name: user.name, detail: user.phone }}
      signOutTo="/staff/login"
    >
      {children}
    </AppShell>
  );
}
