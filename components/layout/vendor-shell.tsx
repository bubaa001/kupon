'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  BadgeDollarSign,
  ChevronDown,
  ClipboardCheck,
  Home,
  LifeBuoy,
  LogOut,
  QrCode,
  Store,
  UserRound,
  UsersRound,
  UtensilsCrossed,
  Wallet,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn, formatTZS } from '@/lib/utils';
import { signOut } from '@/lib/logout';

const NAV = [
  { href: '/vendor', label: 'Home', icon: Home },
  { href: '/vendor/sales', label: 'Sales', icon: BadgeDollarSign },
  { href: '/vendor/scan', label: 'Orders', icon: ClipboardCheck, primary: true },
  { href: '/vendor/credit-requests', label: 'Credit cases', icon: LifeBuoy },
  { href: '/vendor/menu', label: 'Menu', icon: UtensilsCrossed },
  { href: '/vendor/team', label: 'Team', icon: UsersRound },
  { href: '/vendor/settlement', label: 'Settlement', icon: Wallet },
];
const MOBILE_NAV = NAV.filter((item) => item.href !== '/vendor/sales');

export type VendorShellUser = {
  name: string;
  vendorName: string;
  vendorCode: string;
  universityName: string;
  universityCode: string;
  pendingBalance: number;
};

function isActive(pathname: string, href: string) {
  if (href === '/vendor') return pathname === '/vendor';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AccountButton({
  user,
  onClick,
  compact = false,
}: {
  user: VendorShellUser;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[40px] items-center rounded-full border border-slate-200 bg-white transition-colors hover:bg-slate-50',
        compact ? 'gap-0.5 p-0.5 pr-1.5' : 'gap-2 py-1 pl-1 pr-2.5',
      )}
      aria-haspopup="dialog"
      aria-label="Open account menu"
    >
      <Avatar name={user.vendorName} size="sm" />
      <span
        className={cn(
          'truncate text-xs font-medium text-slate-700',
          compact ? 'max-w-[72px]' : 'hidden max-w-[120px] md:inline',
        )}
      >
        {compact ? user.vendorName : user.name}
      </span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
    </button>
  );
}

export function VendorShell({
  user,
  children,
}: {
  user: VendorShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [accountOpen, setAccountOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-canvas">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-navy px-4 py-6 lg:flex">
        <div className="pointer-events-none absolute -left-16 bottom-10 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        <Logo href="/vendor" variant="light" className="relative px-2" />

        <div className="relative mt-8 flex-1">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Vendor terminal
          </p>
          <nav className="space-y-1">
            {NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all',
                    active
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:bg-white/5 hover:text-slate-100',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg transition-colors',
                      active ? 'bg-primary-500 text-white' : 'bg-white/5 text-slate-400',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {item.label === 'Orders' ? 'Orders & coupons' : item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
            <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-primary-300">
              <Store className="h-3.5 w-3.5" />
              Pending settlement
            </div>
            <p className="mt-2 text-xl font-semibold tracking-tight text-white tabular">
              {formatTZS(user.pendingBalance)}
            </p>
            <Link
              href="/vendor/settlement"
              className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-semibold text-white transition-colors hover:bg-white/10"
            >
              View settlements
            </Link>
          </div>
        </div>

        <div className="relative mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.vendorName} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.vendorName}</p>
              <p className="truncate text-[10px] text-slate-500">{user.vendorCode}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut('/login?role=vendor')}
            className="mt-3 flex min-h-[36px] w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 backdrop-blur-md lg:hidden">
          <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
            <Logo href="/vendor" size="sm" />
            <div className="flex items-center gap-1.5">
              <AccountButton user={user} compact onClick={() => setAccountOpen(true)} />
              <button
                type="button"
                onClick={() => void signOut('/login?role=vendor')}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <header className="hidden h-16 items-center justify-between border-b border-slate-200/70 bg-white/70 px-8 backdrop-blur lg:flex">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{user.universityName}</span>
            <span className="text-slate-300">/</span>
            <span>{user.vendorName}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
              Terminal online
            </span>
            <span className="hidden rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 sm:inline">
              {user.vendorCode}
            </span>
            <button
              type="button"
              onClick={() => void signOut('/login?role=vendor')}
              className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
            <AccountButton user={user} onClick={() => setAccountOpen(true)} />
          </div>
        </header>

        <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-left">Vendor account</DialogTitle>
              <DialogDescription className="text-left">
                Signed in as {user.name}. Manage your account or sign out safely.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
              <Avatar name={user.vendorName} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{user.vendorName}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">
                  {user.vendorCode} · {user.universityCode}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{user.universityName}</p>
              </div>
            </div>

            <div className="space-y-1">
              <Link
                href="/vendor/profile"
                onClick={() => setAccountOpen(false)}
                className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <UserRound className="h-4 w-4 text-slate-400" />
                Profile &amp; settings
              </Link>
              <Link
                href="/vendor#counter-qr"
                onClick={() => setAccountOpen(false)}
                className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <QrCode className="h-4 w-4 text-slate-400" />
                Show menu QR
              </Link>
              <a
                href="mailto:support@kupon.co.tz?subject=Vendor%20support"
                className="flex min-h-[46px] items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                <LifeBuoy className="h-4 w-4 text-slate-400" />
                Help &amp; support
              </a>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full justify-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => void signOut('/login?role=vendor')}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </DialogContent>
        </Dialog>

        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Vendor navigation"
        >
          <div className="mx-auto grid h-[68px] max-w-md grid-cols-6 items-center px-1">
            {MOBILE_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              if (item.primary) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex h-full flex-col items-center justify-center"
                  >
                    <span
                      className={cn(
                        'flex h-12 w-12 -translate-y-3 items-center justify-center rounded-2xl border-4 border-white text-white shadow-lg shadow-emerald-500/30 transition-transform active:scale-95',
                        active ? 'bg-primary-600' : 'bg-primary-500',
                      )}
                    >
                      <Icon className="h-5 w-5" strokeWidth={2.4} />
                    </span>
                    <span
                      className={cn(
                        '-mt-2 text-[10px] font-semibold',
                        active ? 'text-primary-700' : 'text-slate-500',
                      )}
                    >
                      {item.label}
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex h-full flex-col items-center justify-center gap-1"
                >
                  <Icon
                    className={cn(
                      'h-[21px] w-[21px] transition-colors',
                      active ? 'text-primary-600' : 'text-slate-400',
                    )}
                    strokeWidth={active ? 2.4 : 2}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium',
                      active ? 'text-primary-700' : 'text-slate-500',
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
