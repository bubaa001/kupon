'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowLeftRight,
  BarChart3,
  Bell,
  Building2,
  ChevronRight,
  CircleDollarSign,
  LayoutDashboard,
  LogOut,
  Menu,
  RotateCcw,
  Settings,
  ShieldCheck,
  Store,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/logout';

export type DashboardKind = 'admin' | 'super' | 'finance';

export type DashboardUser = {
  name: string;
  phone: string;
  roleLabel: string;
  universityName?: string;
  universityCode?: string;
};

type NavItem = { href: string; label: string; icon: typeof LayoutDashboard };
type NavGroup = { title: string; items: NavItem[] };

const ADMIN_NAV: NavGroup[] = [
  {
    title: 'Workspace',
    items: [
      { href: '/admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/admin/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { href: '/admin/vendors', label: 'Vendors', icon: Store },
      { href: '/admin/students', label: 'Students', icon: Users },
      { href: '/admin/team', label: 'Team accounts', icon: Users },
    ],
  },
  {
    title: 'Manage',
    items: [
      { href: '/admin/reports', label: 'Reports', icon: BarChart3 },
    ],
  },
  {
    title: 'System',
    items: [{ href: '/admin/settings', label: 'Settings', icon: Settings }],
  },
];

const SUPER_NAV: NavGroup[] = [
  {
    title: 'Platform',
    items: [
      { href: '/super-admin', label: 'Overview', icon: LayoutDashboard },
      { href: '/super-admin/tenants', label: 'Universities', icon: Building2 },
      { href: '/super-admin/revenue', label: 'Platform revenue', icon: TrendingUp },
      { href: '/super-admin/health', label: 'System health', icon: Activity },
      { href: '/super-admin/finance-users', label: 'Team accounts', icon: Users },
      { href: '/super-admin/vendor-applications', label: 'Vendor review', icon: Store },
      { href: '/super-admin/credit-requests', label: 'Credit approvals', icon: CircleDollarSign },
    ],
  },
];

const FINANCE_NAV: NavGroup[] = [
  {
    title: 'Finance',
    items: [
      { href: '/finance', label: 'Overview', icon: LayoutDashboard },
      { href: '/finance/test-payments', label: 'Payment activity', icon: ArrowLeftRight },
      { href: '/finance/requests', label: 'Credit & support', icon: RotateCcw },
    ],
  },
];

function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === root;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({
  kind,
  user,
  pathname,
  onNavigate,
}: {
  kind: DashboardKind;
  user: DashboardUser;
  pathname: string;
  onNavigate?: () => void;
}) {
  const groups =
    kind === 'admin' ? ADMIN_NAV : kind === 'finance' ? FINANCE_NAV : SUPER_NAV;
  const root = kind === 'admin' ? '/admin' : kind === 'finance' ? '/finance' : '/super-admin';

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-navy text-white">
      <div className="pointer-events-none absolute -right-24 -top-28 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
      <div className="relative flex h-16 items-center px-5">
        <Logo href={root} variant="light" size="sm" />
      </div>

      <div className="relative flex-1 overflow-y-auto px-3 pb-6">
        {groups.map((group) => (
          <div key={group.title} className="mt-4 first:mt-1">
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {group.title}
            </p>
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(pathname, item.href, root);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      'group flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all',
                      active
                        ? 'bg-white/10 text-white'
                        : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                        active ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex-1">{item.label}</span>
                    {active ? <ChevronRight className="h-3.5 w-3.5 text-slate-500" /> : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}

        <div className="mt-6 rounded-xl border border-white/10 bg-white/[0.05] p-3.5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary-300">
            <ShieldCheck className="h-3.5 w-3.5" />
            {kind === 'admin'
              ? 'Isolated tenant'
              : kind === 'finance'
                ? 'Finance operations'
                : 'Platform operations'}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
            {kind === 'admin'
              ? `You are viewing ${user.universityCode ?? 'this campus'} only. Cross-tenant records are blocked at the API.`
              : kind === 'finance'
                ? 'Platform-wide case review and test payment controls. Test records do not represent collected money.'
                : 'All universities are visible here. Financial writes are audit-logged.'}
          </p>
        </div>
      </div>

      <div className="relative border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-white">{user.name}</p>
            <p className="truncate text-[10px] text-slate-500">{user.roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut('/staff/login')}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  kind,
  user,
  children,
}: {
  kind: DashboardKind;
  user: DashboardUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = kind === 'admin' ? '/admin' : kind === 'finance' ? '/finance' : '/super-admin';

  return (
    <div className="dashboard-canvas min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] lg:block">
        <SidebarContent kind={kind} user={user} pathname={pathname} />
      </aside>

      <div className="lg:pl-[260px]">
        <header className="dashboard-glass-header sticky top-0 z-20 border-b border-slate-200/70">
          <div className="flex h-14 items-center justify-between gap-2 px-3 sm:h-16 sm:gap-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white/80 text-slate-600 transition-colors hover:bg-white lg:hidden"
                    aria-label="Open navigation"
                  >
                    <Menu className="h-5 w-5" />
                  </button>
                </DialogTrigger>
                <DialogContent className="left-0 top-0 h-dvh w-[280px] max-w-[85vw] translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-navy p-0 text-white data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left">
                  <DialogTitle className="sr-only">Main navigation</DialogTitle>
                  <SidebarContent
                    kind={kind}
                    user={user}
                    pathname={pathname}
                    onNavigate={() => setOpen(false)}
                  />
                </DialogContent>
              </Dialog>

              <div className="flex min-w-0 items-center gap-2">
                <div className="lg:hidden">
                  <Logo href={root} size="sm" />
                </div>
                <div className="hidden min-w-0 items-center gap-2 text-xs text-slate-500 sm:flex">
                  <span className="truncate font-medium text-slate-700">
                    {kind === 'admin' ? user.universityName : 'Bubaa Comp'}
                  </span>
                  <span className="text-slate-300">/</span>
                  <span className="truncate">
                    {kind === 'admin' ? 'University admin' : 'Platform control'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="success" dot className="hidden sm:inline-flex">
                Live data
              </Badge>
              <button
                type="button"
                className="relative hidden h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 sm:flex"
                aria-label="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-primary-500 ring-2 ring-white" />
              </button>
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2.5">
                <Avatar name={user.name} size="sm" />
                <span className="hidden max-w-[120px] truncate text-xs font-medium text-slate-700 md:inline">
                  {user.name}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
