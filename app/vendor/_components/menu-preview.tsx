'use client';

import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Cookie,
  CupSoda,
  Flame,
  Salad,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FoodProductCard } from '@/components/food';
import { cn, formatTZS } from '@/lib/utils';
import type { MenuItemRow } from '../_lib/types';

const CATEGORY_ICONS: Record<string, typeof UtensilsCrossed> = {
  Popular: Flame,
  'Light meal': Salad,
  Snack: Cookie,
  Drink: CupSoda,
  Special: Sparkles,
};

/**
 * "Preview as student": a real campus food-discovery screen showing every dish
 * the vendor has switched on — photo shortcuts for categories, big photo cards
 * and a sample cart. Nothing is charged.
 */
export function MenuPreview({
  items,
  onExit,
}: {
  items: MenuItemRow[];
  onExit: () => void;
}) {
  const visibleItems = useMemo(() => items.filter((item) => item.available), [items]);

  const [category, setCategory] = useState('Zote');
  const [cart, setCart] = useState<Record<string, number>>({});

  const categories = useMemo(
    () => ['Zote', ...Array.from(new Set(visibleItems.map((item) => item.category)))],
    [visibleItems],
  );

  const shown =
    category === 'Zote'
      ? visibleItems
      : visibleItems.filter((item) => item.category === category);

  const entries = Object.entries(cart)
    .map(([id, quantity]) => {
      const item = visibleItems.find((entry) => entry.id === id);
      return item ? { item, quantity } : null;
    })
    .filter((entry): entry is { item: MenuItemRow; quantity: number } => entry !== null);

  const itemCount = entries.reduce((sum, entry) => sum + entry.quantity, 0);
  const subtotal = entries.reduce((sum, entry) => sum + entry.item.price * entry.quantity, 0);

  function changeQuantity(menuItemId: string, quantity: number) {
    setCart((previous) => {
      const next = { ...previous };
      if (quantity <= 0) delete next[menuItemId];
      else next[menuItemId] = Math.min(10, quantity);
      return next;
    });
  }

  function shortcutImage(categoryName: string): string | null {
    const pool =
      categoryName === 'Zote'
        ? visibleItems
        : visibleItems.filter((item) => item.category === categoryName);
    return pool.find((item) => item.imageUrl)?.imageUrl ?? null;
  }

  return (
    <div className="space-y-4">
      <section
        aria-label="Student menu preview"
        className="relative overflow-hidden rounded-2xl border border-emerald-950/50 bg-[#0E231B] p-4 text-white shadow-lift sm:p-5"
      >
        <div
          className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-emerald-400/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-amber-400/15 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-emerald-200/70">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
              Live student view
            </p>
            <h2 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
              What&apos;s cooking today?
            </h2>
            <p className="mt-1 max-w-md text-[11px] leading-relaxed text-emerald-100/65">
              {visibleItems.length} {visibleItems.length === 1 ? 'dish' : 'dishes'} available — the
              exact menu a student sees after scanning your counter QR. Preview only; nothing is
              charged.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onExit}
            className="border-white/20 bg-white/10 text-white hover:border-white/30 hover:bg-white/15 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Back to managing
          </Button>
        </div>
      </section>

      {visibleItems.length === 0 ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Nothing on the student menu yet"
          description="Switch a dish on in your menu and it appears here immediately — this is what students see after scanning your QR."
          className="border-amber-900/10 bg-[#FFFDF7]"
          action={
            <Button size="sm" variant="outline" onClick={onExit}>
              Back to managing
            </Button>
          }
        />
      ) : (
        <>
          <div
            className="hide-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1"
            role="group"
            aria-label="Browse by category"
          >
            {categories.map((option) => (
              <CategoryShortcut
                key={option}
                label={option}
                imageUrl={shortcutImage(option)}
                active={category === option}
                onClick={() => setCategory(option)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold tracking-tight text-slate-900">
              {category === 'Zote' ? 'Vyakula vyote' : category}
            </h3>
            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">
              {shown.length} {shown.length === 1 ? 'chakula' : 'vyakula'}
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-3.5 pb-24 sm:grid-cols-2 lg:grid-cols-3 lg:pb-0">
            {shown.map((item, index) => (
              <li key={item.id} className="min-w-0">
                <FoodProductCard
                  variant="student"
                  item={item}
                  quantity={cart[item.id] ?? 0}
                  onAdd={() => changeQuantity(item.id, (cart[item.id] ?? 0) + 1)}
                  onRemove={() => changeQuantity(item.id, (cart[item.id] ?? 0) - 1)}
                  priority={index < 3}
                  revealIndex={index}
                />
              </li>
            ))}
          </ul>

          {itemCount > 0 ? (
            <div className="fixed inset-x-0 bottom-[calc(68px+env(safe-area-inset-bottom))] z-20 px-4 lg:static lg:mt-4 lg:px-0">
              <div className="mx-auto flex max-w-md animate-order-in items-center gap-3 rounded-2xl border border-emerald-200 bg-white p-3 shadow-lift lg:max-w-none">
                <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <ShoppingBag className="h-5 w-5" aria-hidden />
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-emerald-600 px-1 text-[10px] font-bold text-white">
                    {itemCount}
                  </span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700/70">
                    Preview cart
                  </p>
                  <p className="text-sm font-semibold tabular text-slate-900">{formatTZS(subtotal)}</p>
                </div>
                <span className="hidden text-[10px] font-medium text-slate-400 sm:block">
                  No payment is taken in preview
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => setCart({})}>
                  Clear
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function CategoryShortcut({
  label,
  imageUrl,
  active,
  onClick,
}: {
  label: string;
  imageUrl: string | null;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = label === 'Zote' ? UtensilsCrossed : (CATEGORY_ICONS[label] ?? UtensilsCrossed);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="flex w-[70px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={cn(
          'relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full ring-2 transition-all',
          active
            ? 'ring-emerald-500 ring-offset-2 ring-offset-canvas'
            : 'ring-transparent hover:ring-emerald-200',
        )}
      >
        {imageUrl ? (
          <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 via-[#FBF6EA] to-emerald-50 text-emerald-700">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </span>
      <span
        className={cn(
          'w-full truncate text-center text-[10px] font-semibold',
          active ? 'text-emerald-800' : 'text-slate-600',
        )}
      >
        {label}
      </span>
    </button>
  );
}
