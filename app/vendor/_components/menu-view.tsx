'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Info,
  LayoutGrid,
  List,
  Plus,
  Search,
  SearchX,
  Trash2,
  UtensilsCrossed,
  Wallet,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FoodProductCard } from '@/components/food';
import { deleteJson, patchJson } from '@/lib/client-api';
import { cn, formatTZS } from '@/lib/utils';
import { toast } from 'sonner';
import { useApiData } from '../_lib/use-api';
import type { MenuItemRow, MenuResponse } from '../_lib/types';
import { MenuItemDialog } from './menu-item-dialog';
import { MenuPreview } from './menu-preview';
import { LoadError } from './feedback';

type MenuFilter = 'ALL' | 'AVAILABLE' | 'HIDDEN';
type MenuViewMode = 'manage' | 'preview';
type MenuLayout = 'grid' | 'list';

const ALL_CATEGORIES = 'ALL';

export function MenuView() {
  const { data, loading, error, reload } = useApiData<MenuResponse>('/api/vendor/menu');

  const [mode, setMode] = useState<MenuViewMode>('manage');
  const [layout, setLayout] = useState<MenuLayout>('grid');
  const [filter, setFilter] = useState<MenuFilter>('ALL');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRow | null>(null);
  const [deleting, setDeleting] = useState<MenuItemRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const items = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary ?? {
    total: 0,
    available: 0,
    pendingApproval: 0,
    rejected: 0,
  };
  const hiddenCount = summary.total - summary.available;
  const averagePrice = items.length
    ? Math.round(items.reduce((total, item) => total + item.price, 0) / items.length)
    : 0;

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === 'AVAILABLE' && !item.available) return false;
      if (filter === 'HIDDEN' && item.available) return false;
      if (category !== ALL_CATEGORIES && item.category !== category) return false;
      if (!needle) return true;
      return `${item.name} ${item.category} ${item.description}`.toLowerCase().includes(needle);
    });
  }, [items, filter, category, search]);

  const filtersActive = filter !== 'ALL' || category !== ALL_CATEGORIES || search.trim() !== '';

  // The terminal is a live app: no manual refresh button. Menu and availability
  // change under the vendor, so poll while visible and refetch when the tab
  // regains focus.
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') reload();
    };
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reload]);

  const filterOptions: { value: MenuFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'All', count: summary.total },
    { value: 'AVAILABLE', label: 'Available', count: summary.available },
    { value: 'HIDDEN', label: 'Hidden', count: hiddenCount },
  ];

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: MenuItemRow) {
    setEditing(item);
    setDialogOpen(true);
  }

  function resetFilters() {
    setFilter('ALL');
    setCategory(ALL_CATEGORIES);
    setSearch('');
  }

  async function toggleAvailability(item: MenuItemRow) {
    if (togglingId) return;
    setTogglingId(item.id);
    try {
      await patchJson(`/api/vendor/menu/${item.id}`, { available: !item.available });
      toast.success(
        item.available ? `${item.name} hidden from students` : `${item.name} is available again`,
        { description: 'Students see the change immediately.' },
      );
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not update availability. Try again.',
      );
    } finally {
      setTogglingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteJson(`/api/vendor/menu/${deleting.id}`);
      toast.success(`${deleting.name} removed from your menu`);
      setDeleting(null);
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not remove this dish. Try again.',
      );
    } finally {
      setDeletingBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={mode === 'preview' ? 'Menu · Preview' : 'Menu'}
        title={mode === 'preview' ? 'Student preview' : 'Your menu'}
        description={
          mode === 'preview'
            ? 'Exactly what a student sees after scanning your counter QR — every dish you have switched on, with the same photos, prices and categories.'
            : 'Everything students can order from your kitchen. Add a dish in seconds, keep prices fresh and switch off what is sold out.'
        }
        actions={
          mode === 'preview' ? undefined : (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              Add dish
            </Button>
          )
        }
      />

      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {loading && !data ? <MenuSkeleton /> : null}

      {data && mode === 'preview' ? (
        <div aria-busy={loading}>
          <MenuPreview items={items} onExit={() => setMode('manage')} />
        </div>
      ) : null}

      {data && mode === 'manage' ? (
        <div className="space-y-4" aria-busy={loading}>
          <MenuBoardHero
            total={summary.total}
            available={summary.available}
            hiddenCount={hiddenCount}
            averagePrice={averagePrice}
            refreshing={loading}
            onPreview={() => setMode('preview')}
          />

          {summary.total > 0 ? (
            <div className="space-y-2.5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative min-w-0 flex-1">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden
                  />
                  <Input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search dishes, categories…"
                    aria-label="Search your menu"
                    className="h-10 pl-9 pr-9 text-xs"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      aria-label="Clear search"
                      className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Tabs value={filter} onValueChange={(value) => setFilter(value as MenuFilter)}>
                    <TabsList className="grid h-10 w-full grid-cols-3 sm:w-auto">
                      {filterOptions.map((option) => (
                        <TabsTrigger
                          key={option.value}
                          value={option.value}
                          className="gap-1 px-3 text-[11px] sm:text-xs"
                        >
                          {option.label}
                          <span className="tabular text-[10px] text-slate-400">{option.count}</span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <LayoutToggle value={layout} onChange={setLayout} />
                </div>
              </div>

              {categories.length > 1 ? (
                <div
                  className="hide-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5"
                  role="group"
                  aria-label="Filter by category"
                >
                  <span className="shrink-0 pr-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Category
                  </span>
                  <CategoryChipButton
                    active={category === ALL_CATEGORIES}
                    onClick={() => setCategory(ALL_CATEGORIES)}
                  >
                    All
                  </CategoryChipButton>
                  {categories.map((option) => (
                    <CategoryChipButton
                      key={option}
                      active={category === option}
                      onClick={() => setCategory(option)}
                    >
                      {option}
                    </CategoryChipButton>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {summary.total === 0 ? (
            <EmptyMenu onCreate={openCreate} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="No dishes match"
              description="Try a different word, or clear the filters to see your whole menu again."
              compact
              className="border-amber-900/10 bg-[#FFFDF7]"
              action={
                <Button variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-0.5">
                <p className="text-[10.5px] font-medium text-slate-500">
                  Showing{' '}
                  <span className="font-semibold text-slate-700">{filteredItems.length}</span> of{' '}
                  {summary.total} dishes
                  {category !== ALL_CATEGORIES ? (
                    <>
                      {' '}
                      in <span className="font-semibold text-emerald-700">{category}</span>
                    </>
                  ) : null}
                </p>
                {filtersActive ? (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-[10.5px] font-semibold text-emerald-700 hover:underline"
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>

              {layout === 'grid' ? (
                <ul className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredItems.map((item, index) => (
                    <li key={item.id} className="min-w-0">
                      <FoodProductCard
                        variant="vendor"
                        item={item}
                        priority={index < 3}
                        revealIndex={index}
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        onToggleAvailability={() => void toggleAvailability(item)}
                        availabilityBusy={togglingId === item.id}
                      />
                    </li>
                  ))}
                  <li className="min-w-0">
                    <AddDishTile onClick={openCreate} />
                  </li>
                </ul>
              ) : (
                <ul className="space-y-2.5">
                  {filteredItems.map((item, index) => (
                    <li key={item.id} className="min-w-0">
                      <FoodProductCard
                        variant="compact"
                        item={item}
                        priority={index < 4}
                        onEdit={() => openEdit(item)}
                        onDelete={() => setDeleting(item)}
                        onToggleAvailability={() => void toggleAvailability(item)}
                        availabilityBusy={togglingId === item.id}
                      />
                    </li>
                  ))}
                  <li className="min-w-0">
                    <button
                      type="button"
                      onClick={openCreate}
                      className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-900/15 bg-[#FFFDF7]/70 text-sm font-semibold text-slate-700 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm ring-1 ring-amber-900/10">
                        <Plus className="h-4 w-4" aria-hidden />
                      </span>
                      Add a dish
                      <span className="text-[10px] font-normal text-slate-400">
                        name, price, photo
                      </span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}

          <InfoNote />
        </div>
      ) : null}

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        onSaved={(message) => {
          toast.success(message);
          reload();
        }}
      />

      <Dialog
        open={deleting !== null}
        onOpenChange={(next) => {
          if (!next && !deletingBusy) setDeleting(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {deleting?.name ?? 'this dish'}?</DialogTitle>
            <DialogDescription>
              The dish disappears from your menu and from the student app. Sales you already
              recorded are not affected.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 rounded-xl border border-red-100 bg-red-50/60 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-red-500 ring-1 ring-red-100">
              <Trash2 className="h-4 w-4" aria-hidden />
            </span>
            <p className="text-[11px] leading-relaxed text-red-700">
              This cannot be undone. If you only want to stop selling it for now, switch it off
              instead — the dish stays on your menu.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)} disabled={deletingBusy}>
              Keep dish
            </Button>
            <Button variant="destructive" loading={deletingBusy} onClick={() => void confirmDelete()}>
              Remove dish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MenuBoardHero({
  total,
  available,
  hiddenCount,
  averagePrice,
  refreshing,
  onPreview,
}: {
  total: number;
  available: number;
  hiddenCount: number;
  averagePrice: number;
  refreshing: boolean;
  onPreview: () => void;
}) {
  const stats = [
    { label: 'Dishes', value: String(total), Icon: UtensilsCrossed },
    { label: 'Available', value: String(available), Icon: CheckCircle2 },
    { label: 'Hidden', value: String(hiddenCount), Icon: EyeOff },
    { label: 'Avg price', value: averagePrice > 0 ? formatTZS(averagePrice) : '—', Icon: Wallet },
  ];

  return (
    <section
      aria-label="Menu board summary"
      className="relative overflow-hidden rounded-2xl border border-emerald-950/50 bg-[#0E231B] p-4 text-white shadow-lift sm:p-5"
    >
      <div
        className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-emerald-400/20 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-amber-400/15 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] opacity-60 [background-size:16px_16px]"
        aria-hidden
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
            Menu board
          </p>
          <h2 className="mt-1.5 text-lg font-semibold tracking-tight sm:text-xl">
            What&apos;s cooking today?
          </h2>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-emerald-100/65">
            {available > 0
              ? `${available} ${available === 1 ? 'dish is' : 'dishes are'} available to students right now.`
              : 'Nothing is available yet — switch a dish on to start selling.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1.5 text-[9.5px] font-semibold text-emerald-100/70">
            <span
              className={cn('h-1.5 w-1.5 rounded-full bg-emerald-400', refreshing && 'animate-pulse')}
              aria-hidden
            />
            {refreshing ? 'Updating…' : 'Auto-updating'}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onPreview}
            className="border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden />
            Preview as student
          </Button>
        </div>
      </div>

      <dl className="relative mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map(({ label, value, Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-white/10 bg-white/[0.07] px-3 py-2.5 backdrop-blur-[2px]"
          >
            <dt className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.13em] text-emerald-100/55">
              <Icon className="h-3 w-3" aria-hidden />
              {label}
            </dt>
            <dd className="mt-1 truncate text-lg font-semibold tracking-tight tabular">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LayoutToggle({
  value,
  onChange,
}: {
  value: MenuLayout;
  onChange: (next: MenuLayout) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-lg border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label="Menu layout"
    >
      <button
        type="button"
        onClick={() => onChange('grid')}
        aria-pressed={value === 'grid'}
        aria-label="Photo grid view"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
          value === 'grid'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        )}
      >
        <LayoutGrid className="h-4 w-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        aria-pressed={value === 'list'}
        aria-label="Compact list view"
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md transition-colors',
          value === 'list'
            ? 'bg-slate-900 text-white'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800',
        )}
      >
        <List className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function CategoryChipButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'min-h-[32px] shrink-0 rounded-full border px-2.5 text-[10.5px] font-semibold transition-colors',
        active
          ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
          : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/60',
      )}
    >
      {children}
    </button>
  );
}

function AddDishTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-900/15 bg-[#FFFDF7]/70 px-6 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-amber-900/10 transition-transform group-hover:scale-105">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-slate-800">Add a dish</span>
      <span className="max-w-[15rem] text-[11px] leading-relaxed text-slate-500">
        Name, price and a photo — under 30 seconds. It goes live on your menu immediately.
      </span>
    </button>
  );
}

function EmptyMenu({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-amber-900/10 bg-[#FFFDF7] px-5 py-8 text-center shadow-[0_12px_28px_-18px_rgba(120,80,20,0.35)]">
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-amber-200/30 blur-3xl"
        aria-hidden
      />
      <div className="relative mx-auto flex max-w-[220px] items-center justify-center">
        <img
          src="/food/photos/pilau-nyama.jpg"
          alt=""
          aria-hidden
          className="h-16 w-16 -rotate-6 rounded-2xl object-cover ring-4 ring-[#FFFDF7] sm:h-20 sm:w-20"
        />
        <img
          src="/food/photos/grilled-chicken.jpg"
          alt=""
          aria-hidden
          className="z-10 -mt-3 h-16 w-16 scale-110 rounded-2xl object-cover ring-4 ring-[#FFFDF7] sm:h-20 sm:w-20"
        />
        <img
          src="/food/chipsi.svg"
          alt=""
          aria-hidden
          className="h-16 w-16 rotate-6 rounded-2xl object-cover ring-4 ring-[#FFFDF7] sm:h-20 sm:w-20"
        />
      </div>
      <h2 className="relative mt-5 text-base font-semibold text-slate-900">Your menu is empty</h2>
      <p className="relative mx-auto mt-1 max-w-sm text-[11.5px] leading-relaxed text-slate-500">
        Add your first dish so students know what they can buy at your till. It appears on the
        student menu as soon as you save it.
      </p>
      <Button className="relative mt-4" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden />
        Add your first dish
      </Button>
      <p className="relative mt-2 text-[10px] text-slate-400">
        Name, price and a photo — under 30 seconds.
      </p>
    </div>
  );
}

function InfoNote() {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-900/10 bg-[#FFFDF7]/80 p-3 text-[10.5px] leading-relaxed text-slate-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700/60" aria-hidden />
      <p>
        Students see every dish you keep switched on. Changes save instantly, prices are in Tanzanian
        shillings and include all taxes.
      </p>
    </div>
  );
}

function MenuSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-[196px] w-full rounded-2xl sm:h-[164px]" />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 flex-1" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-64" />
      </div>
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-7 w-20 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl bg-[#171008] ring-1 ring-black/10"
          >
            <Skeleton className="aspect-[16/10] w-full rounded-none bg-white/10" />
            <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-[#1D1810] px-3 py-3">
              <Skeleton className="h-5 w-20 rounded-full bg-white/10" />
              <Skeleton className="h-4 w-24 bg-white/10" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
