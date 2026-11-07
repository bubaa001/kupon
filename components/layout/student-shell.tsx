'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Clock3,
  CircleDollarSign,
  Home,
  LogOut,
  ScanLine,
  UserRound,
  Wifi,
} from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/logout';

const NAV = [
  { href: '/student', label: 'Nyumbani', icon: Home },
  { href: '/student/history', label: 'Historia', icon: Clock3 },
  { href: '/student/credit-requests', label: 'Credit', icon: CircleDollarSign },
  { href: '/student/pay', label: 'Agiza', icon: ScanLine, primary: true },
  { href: '/student/profile', label: 'Wasifu', icon: UserRound },
];

export type StudentShellUser = {
  name: string;
  phone: string;
  studentId: string;
  universityName: string;
  universityCode: string;
};

function isActive(pathname: string, href: string) {
  if (href === '/student') return pathname === '/student';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function StudentShell({
  user,
  children,
}: {
  user: StudentShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-navy px-4 py-6 lg:flex">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-primary-500/10 blur-3xl" />
        <Logo href="/student" variant="light" className="relative px-2" />

        <div className="relative mt-8 flex-1">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Mwanafunzi
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
                    'group flex min-h-[44px] items-center gap-3 rounded-xl px-3 text-sm font-medium transition-all',
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
                  {item.label === 'Agiza' ? 'Scan QR na uagize' : item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="relative mt-4 border-t border-white/10 pt-4">
          <div className="flex items-center gap-3 px-1">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-slate-500">{user.studentId}</p>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-canvas/95 backdrop-blur-xl lg:hidden">
          <div className="mx-auto flex h-16 max-w-md items-center justify-between px-4">
            <Logo href="/student" size="sm" />
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                <Wifi className="h-3 w-3" />
                {user.universityCode}
              </span>
              <Link href="/student/profile" aria-label="Open profile">
                <Avatar name={user.name} size="sm" />
              </Link>
            </div>
          </div>
        </header>

        {/* Desktop top strip */}
        <header className="hidden h-16 items-center justify-between border-b border-slate-200/70 bg-white/70 px-8 backdrop-blur lg:flex">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-medium text-slate-700">{user.universityName}</span>
            <span className="text-slate-300">/</span>
            <span>Mwanafunzi</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-[10px] font-semibold text-primary-800">
              {user.universityCode}
            </span>
            <Link href="/student/profile" aria-label="Profile">
              <Avatar name={user.name} size="sm" />
            </Link>
          </div>
        </header>

        <main className="student-workspace mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          {children}
        </main>

        {/* Mobile bottom navigation */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
          aria-label="Urambazaji wa mwanafunzi"
        >
          <div className="mx-auto grid h-[68px] max-w-md grid-cols-5 items-center px-1">
            {NAV.map((item) => {
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
