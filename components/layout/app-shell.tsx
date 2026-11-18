'use client';

import { useEffect, useState } from 'react';
import { refreshPushSubscription } from '@/lib/push-client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, MoreHorizontal, type LucideIcon } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { Avatar } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { signOut } from '@/lib/logout';

export type AppNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shorter label for the mobile tab bar. */
  shortLabel?: string;
  /** Emphasised as the main action in the mobile tab bar. */
  primary?: boolean;
};

export type AppNavGroup = { title?: string; items: AppNavItem[] };

export type AppShellProps = {
  /** Role home, e.g. `/admin`. Only an exact match marks it active. */
  homeHref: string;
  /** Short role name shown in the sidebar and account sheet, e.g. "University admin". */
  roleLabel: string;
  /** The organisation the user works in, e.g. a university or cafeteria name. */
  orgLabel?: string;
  groups: AppNavGroup[];
  /** Hrefs shown in the mobile tab bar (max 4). Everything else goes under "More". */
  mobileTabs: string[];
  user: { name: string; detail?: string };
  signOutTo?: string;
  /** Extra content at the bottom of the desktop sidebar. */
  sidebarExtra?: React.ReactNode;
  /** Extra links in the account sheet (profile, help). */
  accountLinks?: AppNavItem[];
  /** Extra controls in the account sheet, e.g. the language switch. */
  sheetExtra?: React.ReactNode;
  /** `narrow` keeps phone-first pages readable on desktop. */
  width?: 'wide' | 'narrow';
  children: React.ReactNode;
};

/** First real name, skipping titles such as "Dr." or "Mr.". */
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.find((part) => !part.endsWith('.')) ?? parts[0] ?? name;
}

export function isNavActive(pathname: string, href: string, homeHref: string) {
  if (href === homeHref) return pathname === homeHref;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarLink({
  item,
  active,
}: {
  item: AppNavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex min-h-[42px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-navy-300 hover:bg-white/[0.04] hover:text-white',
      )}
    >
      {active ? (
        <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-gold" />
      ) : null}
      <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-gold' : 'text-navy-300')} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function AppShell({
  homeHref,
  roleLabel,
  orgLabel,
  groups,
  mobileTabs,
  user,
  signOutTo,
  sidebarExtra,
  accountLinks = [],
  sheetExtra,
  width = 'wide',
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Keep this device's push subscription tied to whoever is signed in now.
  useEffect(() => {
    void refreshPushSubscription();
  }, []);

  const allItems = groups.flatMap((group) => group.items);
  const current =
    allItems.find((item) => isNavActive(pathname, item.href, homeHref)) ?? null;
  const tabs = mobileTabs
    .map((href) => allItems.find((item) => item.href === href))
    .filter((item): item is AppNavItem => Boolean(item))
    .slice(0, 4);
  const overflow = allItems.filter((item) => !tabs.includes(item));
  const overflowActive = overflow.some((item) => isNavActive(pathname, item.href, homeHref));
  const tabCount = tabs.length + 1;

  const doSignOut = () => void signOut(signOutTo);

  return (
    <div className="min-h-dvh bg-canvas">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy text-white lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo href={homeHref} variant="light" size="sm" />
        </div>
        <div className="px-5 pb-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">
            {roleLabel}
          </p>
          {orgLabel ? (
            <p className="mt-1 truncate text-xs text-navy-300" title={orgLabel}>
              {orgLabel}
            </p>
          ) : null}
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-6" aria-label={`${roleLabel} navigation`}>
          {groups.map((group, index) => (
            <div key={group.title ?? index} className={cn(index > 0 && 'mt-5')}>
              {group.title ? (
                <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-navy-300/60">
                  {group.title}
                </p>
              ) : null}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.href}
                    item={item}
                    active={isNavActive(pathname, item.href, homeHref)}
                  />
                ))}
              </div>
            </div>
          ))}
          {sidebarExtra ? <div className="mt-6">{sidebarExtra}</div> : null}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{user.name}</p>
              {user.detail ? (
                <p className="truncate text-[11px] text-navy-300">{user.detail}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={doSignOut}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-navy-300 transition-colors hover:bg-white/10 hover:text-white"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        {/* Mobile top bar: solid navy so the brand stays visible over any page. */}
        <header className="sticky top-0 z-20 bg-navy text-white lg:hidden">
          <div className="flex h-14 items-center justify-between gap-3 px-4">
            <Logo href={homeHref} variant="light" size="sm" />
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="flex min-h-10 items-center gap-2 rounded-full bg-white/[0.08] py-1 pl-1 pr-3 text-xs font-medium text-white"
              aria-haspopup="dialog"
              aria-label="Open account menu"
            >
              <Avatar name={user.name} size="sm" />
              <span className="max-w-[110px] truncate">{shortName(user.name)}</span>
            </button>
          </div>
        </header>

        {/* Desktop top bar: solid white, names the current page. */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between gap-4 border-b border-navy/[0.08] bg-white px-8 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-navy">
              {current?.label ?? roleLabel}
            </p>
            {orgLabel ? <p className="truncate text-xs text-ink-muted">{orgLabel}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex min-h-10 items-center gap-2 rounded-full border border-navy/10 bg-white py-1 pl-1 pr-3 text-xs font-medium text-navy transition-colors hover:bg-navy-50"
            aria-haspopup="dialog"
            aria-label="Open account menu"
          >
            <Avatar name={user.name} size="sm" />
            <span className="max-w-[160px] truncate">{user.name}</span>
          </button>
        </header>

        <main
          className={cn(
            'mx-auto w-full px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8',
            width === 'wide' ? 'max-w-[1440px]' : 'max-w-5xl',
          )}
        >
          {children}
        </main>

        {/* Mobile tab bar: solid white, never translucent. */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
          aria-label={`${roleLabel} navigation`}
        >
          <div
            className="mx-auto grid h-16 max-w-lg items-stretch px-1"
            style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}
          >
            {tabs.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href, homeHref);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className="relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium"
                >
                  {active ? (
                    <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gold" />
                  ) : null}
                  <span
                    className={cn(
                      'flex h-8 items-center justify-center rounded-full transition-colors',
                      item.primary ? 'w-12 bg-navy text-gold' : 'w-8',
                      !item.primary && (active ? 'text-navy' : 'text-ink-muted'),
                    )}
                  >
                    <Icon className="h-[19px] w-[19px]" strokeWidth={active ? 2.3 : 1.9} />
                  </span>
                  <span className={cn('truncate', active ? 'font-semibold text-navy' : 'text-ink-muted')}>
                    {item.shortLabel ?? item.label}
                  </span>
                </Link>
              );
            })}
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="relative flex flex-col items-center justify-center gap-1 text-[10px] font-medium"
              aria-haspopup="dialog"
            >
              {overflowActive ? (
                <span aria-hidden className="absolute inset-x-4 top-0 h-[3px] rounded-b-full bg-gold" />
              ) : null}
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center',
                  overflowActive ? 'text-navy' : 'text-ink-muted',
                )}
              >
                <MoreHorizontal className="h-[19px] w-[19px]" />
              </span>
              <span className={overflowActive ? 'font-semibold text-navy' : 'text-ink-muted'}>More</span>
            </button>
          </div>
        </nav>
      </div>

      <Dialog open={sheetOpen} onOpenChange={setSheetOpen}>
        <DialogContent className="max-w-sm gap-4">
          <DialogHeader>
            <DialogTitle className="text-left">{user.name}</DialogTitle>
            <DialogDescription className="text-left">
              {[roleLabel, orgLabel].filter(Boolean).join(' · ')}
            </DialogDescription>
          </DialogHeader>

          {overflow.length ? (
            <div className="lg:hidden">
              <p className="eyebrow mb-1.5">More pages</p>
              <div className="space-y-0.5">
                {overflow.map((item) => (
                  <SheetLink
                    key={item.href}
                    item={item}
                    active={isNavActive(pathname, item.href, homeHref)}
                    onNavigate={() => setSheetOpen(false)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {accountLinks.length ? (
            <div>
              <p className="eyebrow mb-1.5">Account</p>
              <div className="space-y-0.5">
                {accountLinks.map((item) => (
                  <SheetLink
                    key={item.href}
                    item={item}
                    active={isNavActive(pathname, item.href, homeHref)}
                    onNavigate={() => setSheetOpen(false)}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {sheetExtra}

          <button
            type="button"
            onClick={doSignOut}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SheetLink({
  item,
  active,
  onNavigate,
}: {
  item: AppNavItem;
  active: boolean;
  onNavigate: () => void;
}) {
  const Icon = item.icon;
  const external = item.href.startsWith('mailto:');
  const className = cn(
    'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors',
    active ? 'bg-navy-50 text-navy' : 'text-navy/80 hover:bg-navy-50',
  );
  const content = (
    <>
      <Icon className={cn('h-4 w-4', active ? 'text-gold-600' : 'text-ink-muted')} />
      {item.label}
    </>
  );
  if (external) {
    return (
      <a href={item.href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={onNavigate} className={className} aria-current={active ? 'page' : undefined}>
      {content}
    </Link>
  );
}
