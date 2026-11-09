'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardCheck, LogOut, UtensilsCrossed } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/logout';

const NAV = [
  { href: '/staff', label: 'Orders & coupons', icon: ClipboardCheck },
  { href: '/staff/menu', label: 'Today’s menu', icon: UtensilsCrossed },
];

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
  const pathname = usePathname();

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <Logo href="/staff" size="sm" />
            <span className="hidden h-7 border-l border-slate-200 sm:block" />
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-xs font-semibold text-slate-800">{vendorName}</p>
              <p className="text-[10px] text-slate-500">{vendorCode}</p>
            </div>
          </div>
          <nav aria-label="Staff navigation" className="hidden items-center gap-1 sm:flex">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === '/staff' ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={label}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
                </Link>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={() => void signOut('/staff/login')}
            className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            aria-label={`Sign out ${name}`}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav
          aria-label="Staff navigation"
          className="mx-auto grid max-w-6xl grid-cols-2 gap-2 px-4 pb-2 sm:hidden"
        >
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === '/staff' ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {href === '/staff' ? 'Orders' : 'Menu'}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-[calc(2.5rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-8">
        <div className="mb-5 sm:hidden">
          <p className="text-sm font-semibold text-slate-800">{vendorName}</p>
          <p className="text-[11px] text-slate-500">Signed in as {name}</p>
        </div>
        {children}
      </main>
    </div>
  );
}
