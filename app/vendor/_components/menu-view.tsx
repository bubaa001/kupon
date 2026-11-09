'use client';

import { useMemo, useState } from 'react';
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FoodProductCard } from '@/components/food';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
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

export function MenuView({ audience = 'vendor' }: { audience?: 'vendor' | 'staff' }) {
  const apiPath = audience === 'staff' ? '/api/staff/menu' : '/api/vendor/menu';
  const { data, loading, error, reload } = useApiData<MenuResponse>(apiPath);

  const [mode, setMode] = useState<MenuViewMode>('manage');
  const [layout, setLayout] = useState<MenuLayout>(audience === 'staff' ? 'list' : 'grid');
  const [filter, setFilter] = useState<MenuFilter>('ALL');
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRow | null>(null);
  const [deleting, setDeleting] = useState<MenuItemRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState<string | null>(null);
  const [autoAcceptBusy, setAutoAcceptBusy] = useState(false);

  const items = useMemo(() => data?.items ?? [], [data]);
  const summary = data?.summary ?? {
    total: 0,
    available: 0,
    pendingApproval: 0,
    rejected: 0,
  };
  const soldOutCount = summary.total - summary.available;
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

  const filterOptions: { value: MenuFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'All', count: summary.total },
    { value: 'AVAILABLE', label: 'In stock', count: summary.available },
    { value: 'HIDDEN', label: 'Not in stock', count: soldOutCount },
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

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteJson(`${apiPath}/${deleting.id}`);
      toast.success(`${deleting.name} removed from the menu`);
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

  async function toggleAvailability(item: MenuItemRow) {
    setAvailabilityBusy(item.id);
    try {
      await patchJson(`${apiPath}/${item.id}`, { available: !item.available });
      toast.success(`${item.name} is ${item.available ? 'unavailable' : 'available'} to students.`);
      reload();
    } catch (cause) {
      toast.error(cause instanceof Error && cause.message ? cause.message : 'Could not update stock.');
    } finally {
      setAvailabilityBusy(null);
    }
  }

  async function toggleAutoAccept(enabled: boolean) {
    setAutoAcceptBusy(true);
    try {
      await patchJson<{ enabled: boolean }>('/api/staff/menu/auto-accept', { enabled });
      toast.success(
        enabled
          ? 'All incoming meal requests will be accepted automatically.'
          : 'New meal requests will wait for staff approval.',
      );
      reload();
    } catch (cause) {
      toast.error(
        cause instanceof Error && cause.message
          ? cause.message
          : 'Could not update request acceptance.',
      );
    } finally {
      setAutoAcceptBusy(false);
    }
  }

  return (
    <div className="min-w-0 space-y-5">
      <PageHeader
        eyebrow={mode === 'preview' ? 'Menu · Preview' : 'Menu'}
        title={
          mode === 'preview'
            ? 'Student preview'
            : audience === 'staff'
              ? 'Today’s menu'
              : 'Your menu'
        }
        description={
          mode === 'preview'
            ? 'Exactly what a student sees after scanning your counter QR — dishes staff have marked in stock, with their photos, prices and categories.'
            : audience === 'staff'
              ? 'Keep today’s student menu accurate. Add foods, update prices and photos, and mark items in stock as service changes.'
              : 'Manage your cafeteria’s dishes, photos and prices from anywhere. Your staff update what is in stock each day.'
        }
        actions={
          mode === 'preview' ? undefined : (
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" aria-hidden />
              {audience === 'staff' ? 'Add food' : 'Add dish'}
            </Button>
          )
        }
      />

      {error && !data ? <LoadError message={error} onRetry={reload} /> : null}

      {loading && !data ? (
        <MenuLoadingSkeleton audience={audience} />
      ) : null}

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
            hiddenCount={soldOutCount}
            averagePrice={averagePrice}
            refreshing={loading}
            onPreview={() => setMode('preview')}
            audience={audience}
          />

          {audience === 'staff' && items.length > 0 ? (
            <Card className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Automatically accept all meal requests
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  When enabled, students can pay as soon as their request arrives. When disabled,
                  staff accept each request before the student can pay.
                </p>
              </div>
              <Switch
                checked={items.every((item) => item.autoAccept)}
                onCheckedChange={(enabled) => void toggleAutoAccept(enabled)}
                disabled={autoAcceptBusy}
                aria-label="Automatically accept all meal requests"
              />
            </Card>
          ) : null}

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

                <div className="flex min-w-0 items-center gap-2">
                  <Tabs
                    value={filter}
                    onValueChange={(value) => setFilter(value as MenuFilter)}
                    className="min-w-0 flex-1"
                  >
                    <TabsList className="grid h-10 w-full grid-cols-3">
                      {filterOptions.map((option) => (
                        <TabsTrigger
                          key={option.value}
                          value={option.value}
                          className="min-w-0 gap-1 px-1.5 text-[10px] sm:px-3 sm:text-xs"
                        >
                          {option.label}
                          <span className="tabular text-[10px] text-slate-400 max-[379px]:hidden">
                            {option.count}
                          </span>
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                  <LayoutToggle value={layout} onChange={setLayout} />
                </div>
              </div>

              {categories.length > 1 ? (
                <div
                  className="-mx-1 flex items-center gap-1.5 overflow-x-auto overscroll-x-contain px-1 pb-1.5 pt-1 touch-pan-x"
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
            <EmptyMenu onCreate={openCreate} audience={audience} />
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
                        availabilityAction={
                          audience === 'staff' ? (
                            <AvailabilityButton
                              item={item}
                              busy={availabilityBusy === item.id}
                              disabled={availabilityBusy !== null}
                              onToggle={() => void toggleAvailability(item)}
                            />
                          ) : undefined
                        }
                      />
                    </li>
                  ))}
                  <li className="min-w-0">
                    <AddDishTile onClick={openCreate} audience={audience} />
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
                        availabilityAction={
                          audience === 'staff' ? (
                            <AvailabilityButton
                              item={item}
                              busy={availabilityBusy === item.id}
                              disabled={availabilityBusy !== null}
                              onToggle={() => void toggleAvailability(item)}
                            />
                          ) : undefined
                        }
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
                      {audience === 'staff' ? 'Add food' : 'Add a dish'}
                      <span className="text-[10px] font-normal text-slate-400">
                        name, price, photo
                      </span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          )}

          <InfoNote audience={audience} />
        </div>
      ) : null}

      <MenuItemDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        item={editing}
        apiPath={apiPath}
        audience={audience}
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
              This cannot be undone. To stop selling it temporarily, ask staff to mark it
              unavailable; the dish will stay on your menu.
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
  audience,
}: {
  total: number;
  available: number;
  hiddenCount: number;
  averagePrice: number;
  refreshing: boolean;
  onPreview: () => void;
  audience: 'vendor' | 'staff';
}) {
  if (audience === 'staff') {
    const readiness = total > 0 ? Math.round((available / total) * 100) : 0;
    const status =
      total === 0
        ? 'Add food to open service'
        : available === 0
          ? 'No food marked in stock'
          : available === total
            ? 'Everything is ready to serve'
            : `${available} ${available === 1 ? 'food is' : 'foods are'} ready to serve`;

    return (
      <section
        aria-label="Today’s service status"
        className="relative overflow-hidden rounded-2xl border border-emerald-950/15 bg-white shadow-card"
      >
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-xl bg-[#10291F] text-white">
              <span className="text-[25px] font-semibold leading-none tabular">{available}</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-100/70">
                of {total} ready
              </span>
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                Service board
              </p>
              <h2 className="mt-1 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                {status}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Students only see foods marked in stock.
                {hiddenCount > 0 ? ` ${hiddenCount} ${hiddenCount === 1 ? 'food is' : 'foods are'} paused.` : ''}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:pl-4">
            <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-emerald-50 px-3 text-[10px] font-semibold text-emerald-800">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full bg-emerald-500',
                  refreshing && 'animate-pulse',
                )}
                aria-hidden
              />
              {refreshing ? 'Updating' : 'Live stock'}
            </span>
            <Button type="button" variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-3.5 w-3.5" aria-hidden />
              Student view
            </Button>
          </div>
        </div>

        <div
          className="h-1 bg-slate-100"
          role="progressbar"
          aria-label="Menu availability"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={readiness}
        >
          <div
            className="h-full bg-emerald-500 transition-[width] duration-300"
            style={{ width: `${readiness}%` }}
          />
        </div>
      </section>
    );
  }

  const stats = [
    { label: 'Dishes', value: String(total), Icon: UtensilsCrossed },
    { label: 'In stock', value: String(available), Icon: CheckCircle2 },
    { label: 'Not in stock', value: String(hiddenCount), Icon: EyeOff },
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
            Menu at a glance
          </h2>
          <p className="mt-1 max-w-md text-[11px] leading-relaxed text-emerald-100/65">
            {available > 0
              ? `Staff have marked ${available} ${available === 1 ? 'dish' : 'dishes'} in stock for students right now.`
              : 'No dishes are marked in stock. Staff can update availability from their menu.'}
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

function MenuLoadingSkeleton({ audience }: { audience: 'vendor' | 'staff' }) {
  return (
    <div role="status" aria-label="Loading menu" aria-busy="true" className="space-y-4">
      {audience === 'staff' ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
          <div className="flex items-center gap-4 p-4 sm:px-5 sm:py-4">
            <Skeleton className="h-[68px] w-[68px] shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-5 w-56 max-w-full" />
              <Skeleton className="h-3 w-72 max-w-full" />
            </div>
          </div>
          <Skeleton className="h-1 w-full rounded-none" />
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-card sm:p-5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-3 w-64 max-w-full" />
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-16 rounded-xl" />
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <Skeleton className="h-10 flex-1 rounded-xl" />
        <Skeleton className="h-10 w-full rounded-xl sm:w-72" />
      </div>

      <ul className="space-y-2.5" aria-hidden="true">
        {[0, 1, 2].map((item) => (
          <li
            key={item}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2.5"
          >
            <Skeleton className="h-[68px] w-[68px] shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="hidden h-8 w-28 rounded-lg sm:block" />
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading {audience === 'staff' ? 'today’s menu' : 'menu'}…</span>
    </div>
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

function AddDishTile({
  onClick,
  audience,
}: {
  onClick: () => void;
  audience: 'vendor' | 'staff';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-amber-900/15 bg-[#FFFDF7]/70 px-6 py-8 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50/40"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-sm ring-1 ring-amber-900/10 transition-transform group-hover:scale-105">
        <Plus className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-sm font-semibold text-slate-800">
        {audience === 'staff' ? 'Add food' : 'Add a dish'}
      </span>
      <span className="max-w-[15rem] text-[11px] leading-relaxed text-slate-500">
        {audience === 'staff'
          ? 'Add the dish and its price to today’s student menu.'
          : 'Name, price and a photo — under 30 seconds. Staff set daily availability.'}
      </span>
    </button>
  );
}

function EmptyMenu({
  onCreate,
  audience,
}: {
  onCreate: () => void;
  audience: 'vendor' | 'staff';
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-card sm:flex-row sm:items-center sm:gap-5 sm:p-6 sm:text-left">
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
        <UtensilsCrossed className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold text-slate-900">
          {audience === 'staff' ? 'No food on today’s menu' : 'Your menu is empty'}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">
          {audience === 'staff'
            ? 'Add the foods being served at the cafeteria. They will appear for students as soon as you save them.'
            : 'Add your first dish so students know what your cafeteria serves. Staff will mark it in stock before students can order it.'}
        </p>
      </div>
      <Button className="w-full shrink-0 sm:w-auto" onClick={onCreate}>
        <Plus className="h-4 w-4" aria-hidden />
        {audience === 'staff' ? 'Add food' : 'Add your first dish'}
      </Button>
    </div>
  );
}

function AvailabilityButton({
  item,
  busy,
  disabled,
  onToggle,
}: {
  item: MenuItemRow;
  busy: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      variant={item.available ? 'outline' : 'default'}
      size="sm"
      className="shrink-0 px-2 text-[10px]"
      loading={busy}
      disabled={disabled}
      aria-pressed={item.available}
      aria-label={`Mark ${item.name} ${item.available ? 'unavailable' : 'available'}`}
      onClick={onToggle}
    >
      {item.available ? (
        <>
          <EyeOff className="h-3.5 w-3.5" aria-hidden />
          Unavailable
        </>
      ) : (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          Available
        </>
      )}
    </Button>
  );
}

function InfoNote({ audience }: { audience: 'vendor' | 'staff' }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-900/10 bg-[#FFFDF7]/80 p-3 text-[10.5px] leading-relaxed text-slate-500">
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700/60" aria-hidden />
      <p>
        {audience === 'staff'
          ? 'Manage the menu at the cafeteria: add and update food, set prices, and keep availability current. Owners can review changes remotely. Prices are in Tanzanian shillings.'
          : 'You manage dishes and prices remotely. Staff set daily stock at the cafeteria, and students only see dishes staff mark in stock. Prices are in Tanzanian shillings and include all taxes.'}
      </p>
    </div>
  );
}
