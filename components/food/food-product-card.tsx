'use client';

import { CheckCircle2, EyeOff, Flame, Minus, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatNumber } from '@/lib/utils';
import { FOOD_QUANTITY_MAX } from './food-data';
import { FoodImage } from './food-image';

/**
 * A menu item as the food cards need it. This is a structural subset of
 * `MenuItemRow` (vendor) and `VendorMenuData['items'][number]` (student), so the
 * same card can be used by both apps without importing either page's types.
 */
export type FoodProduct = {
  id?: string;
  name: string;
  description?: string | null;
  price: number;
  category?: string | null;
  imageUrl?: string | null;
  available?: boolean;
  /** Approval state retained for consumers that still expose it. */
  approvalStatus?: string | null;
  updatedAt?: string | null;
};

export type FoodProductCardVariant = 'student' | 'vendor' | 'compact';

export type FoodProductCardProps = {
  item: FoodProduct;
  variant?: FoodProductCardVariant;
  /** Student: current quantity in the cart. */
  quantity?: number;
  onAdd?: () => void;
  onRemove?: () => void;
  maxQuantity?: number;
  /** Vendor: row actions. */
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  /** Eager-load the hero (first row of a menu). */
  priority?: boolean;
  /** Staggers the `animate-order-in` entrance in a menu grid. */
  revealIndex?: number;
};

/** Emerald price pill used on light surfaces (compact/list rows). */
export function FoodPrice({ price, className }: { price: number; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-baseline gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[11.5px] font-bold leading-none text-white shadow-sm shadow-emerald-900/25 tabular',
        className,
      )}
    >
      <span className="text-[8px] font-semibold tracking-wide text-emerald-50/90">TZS</span>
      {price > 0 ? formatNumber(price) : '—'}
    </span>
  );
}

function PriceOnDark({ price }: { price: number }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 font-bold leading-none text-white backdrop-blur-md">
      <span className="text-[8px] font-semibold tracking-wide text-white/60">TZS</span>
      <span className="text-[13px] tabular">{price > 0 ? formatNumber(price) : '—'}</span>
    </span>
  );
}

function CategoryChip({
  category,
  tone = 'dark',
}: {
  category?: string | null;
  tone?: 'dark' | 'light';
}) {
  const label = category?.trim() || 'Main';
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]',
        tone === 'dark'
          ? 'border-white/25 bg-black/40 text-white backdrop-blur-md'
          : 'border-amber-900/10 bg-amber-50 text-amber-800/80',
      )}
    >
      {label.toLowerCase() === 'popular' ? <Flame className="h-2.5 w-2.5" aria-hidden /> : null}
      {label}
    </span>
  );
}

function StudentActions({
  name,
  quantity,
  onAdd,
  onRemove,
  maxQuantity,
  available,
  fullWidth,
}: {
  name: string;
  quantity: number;
  onAdd?: () => void;
  onRemove?: () => void;
  maxQuantity: number;
  available: boolean;
  fullWidth: boolean;
}) {
  if (!onAdd) return null;

  if (quantity > 0) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-between rounded-xl font-bold shadow-sm',
          fullWidth
            ? 'h-10 w-full bg-white/95 text-[#1a1206]'
            : 'h-8 bg-emerald-600 text-white shadow-emerald-900/30',
        )}
      >
        <button
          type="button"
          onClick={onRemove}
          disabled={!onRemove}
          aria-label={`Remove one ${name}`}
          className={cn(
            'flex h-full items-center justify-center rounded-l-xl transition-colors active:scale-95 disabled:opacity-40',
            fullWidth ? 'w-10 hover:bg-black/5' : 'w-8',
          )}
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden />
        </button>
        <span aria-live="polite" className="min-w-[1rem] text-center text-[11px] tabular">
          {quantity}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={quantity >= maxQuantity}
          aria-label={`Add another ${name}`}
          className={cn(
            'flex h-full items-center justify-center rounded-r-xl transition-colors active:scale-95 disabled:opacity-40',
            fullWidth ? 'w-10 hover:bg-black/5' : 'w-8',
          )}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={!available}
      aria-label={`Add ${name} to order`}
      className={cn(
        'flex shrink-0 items-center justify-center gap-1.5 rounded-xl font-bold shadow-sm transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed',
        fullWidth
          ? 'h-10 w-full bg-white/95 text-[11.5px] text-[#1a1206] hover:bg-white disabled:bg-white/40 disabled:text-black/40'
          : 'h-8 bg-emerald-600 px-2.5 text-[11px] text-white shadow-emerald-900/30 hover:bg-emerald-700 disabled:bg-slate-400/90',
      )}
    >
      <Plus className="h-3.5 w-3.5" strokeWidth={2.8} aria-hidden />
      Add to order
    </button>
  );
}

function StudentCard({
  item,
  quantity,
  onAdd,
  onRemove,
  maxQuantity,
  priority,
  revealIndex,
  className,
}: FoodProductCardProps & { maxQuantity: number }) {
  const available = item.available !== false;
  const isPopular = item.category?.trim().toLowerCase() === 'popular';

  return (
    <article
      style={
        revealIndex !== undefined
          ? { animationDelay: `${Math.min(revealIndex, 10) * 45}ms` }
          : undefined
      }
      className={cn(
        'group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-[#171008] ring-1 ring-black/10 shadow-[0_20px_44px_-26px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:-translate-y-1 animate-order-in',
        className,
      )}
      aria-label={item.name}
    >
      <div className="relative aspect-[16/11] w-full overflow-hidden sm:aspect-[16/10]">
        <FoodImage
          src={item.imageUrl}
          name={item.name}
          priority={priority}
          imageClassName={cn(
            'transition-transform duration-300 ease-out group-hover:scale-[1.04]',
            !available && 'saturate-[0.6]',
          )}
          fallbackClassName="bg-[#171008]"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.7)_0.6px,transparent_0.6px)] [background-size:6px_6px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[#0a0602]/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/60 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[94%] bg-gradient-to-t from-[#050301] via-[#050301]/88 to-transparent"
          aria-hidden
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1.5 p-3">
          <CategoryChip category={item.category} />
          {isPopular && available ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-[#3b2405] shadow-sm">
              <Flame className="h-2.5 w-2.5" aria-hidden />
              Top pick
            </span>
          ) : null}
          {!available ? (
            <span className="rounded-full border border-white/20 bg-black/50 px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-white backdrop-blur-md">
              Sold out
            </span>
          ) : null}
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 min-w-0 text-[18px] font-bold leading-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
              {item.name}
            </h3>
            <PriceOnDark price={item.price} />
          </div>
          <p className="mt-1 line-clamp-2 min-h-[1.7rem] break-words text-[11px] leading-relaxed text-white/75">
            {item.description?.trim() || ''}
          </p>
          <div className="mt-2.5">
            <StudentActions
              name={item.name}
              quantity={quantity ?? 0}
              onAdd={onAdd}
              onRemove={onRemove}
              maxQuantity={maxQuantity}
              available={available}
              fullWidth
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function VendorCard({
  item,
  onEdit,
  onDelete,
  priority,
  revealIndex,
  className,
}: FoodProductCardProps) {
  const available = item.available !== false;

  return (
    <article
      style={
        revealIndex !== undefined
          ? { animationDelay: `${Math.min(revealIndex, 10) * 45}ms` }
          : undefined
      }
      className={cn(
        'group relative flex h-full min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-[#171008] ring-1 ring-black/10 shadow-[0_20px_44px_-26px_rgba(0,0,0,0.7)] transition-transform duration-300 hover:-translate-y-1 animate-order-in',
        className,
      )}
      aria-label={item.name}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <FoodImage
          src={item.imageUrl}
          name={item.name}
          priority={priority}
          imageClassName={cn(
            'transition-transform duration-300 ease-out group-hover:scale-[1.04]',
            !available && 'saturate-[0.65]',
          )}
          fallbackClassName="bg-[#171008]"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.14] mix-blend-overlay [background-image:radial-gradient(rgba(255,255,255,0.7)_0.6px,transparent_0.6px)] [background-size:6px_6px]"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-0 bg-[#0a0602]/15"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/65 to-transparent"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[92%] bg-gradient-to-t from-[#050301] via-[#050301]/85 to-transparent"
          aria-hidden
        />

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-1.5 p-3">
          <CategoryChip category={item.category} />
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.08em] backdrop-blur-md',
              available
                ? 'border-white/25 bg-black/35 text-white'
                : 'border-amber-200/30 bg-slate-950/60 text-amber-100',
            )}
          >
            {available ? (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                In stock
              </>
            ) : (
              <>
                <EyeOff className="h-2.5 w-2.5" aria-hidden />
                Not in stock
              </>
            )}
          </span>
        </div>

        <div className="absolute inset-x-0 bottom-0 z-10 p-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-1 min-w-0 text-[18px] font-bold leading-tight text-white [text-shadow:0_1px_12px_rgba(0,0,0,0.5)]">
              {item.name}
            </h3>
            <PriceOnDark price={item.price} />
          </div>
          <p className="mt-1 line-clamp-2 min-h-[1.55rem] break-words text-[10.5px] leading-relaxed text-white/75">
            {item.description?.trim() || 'No description yet.'}
          </p>
        </div>

      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 bg-[#1D1810] px-2.5 py-1.5 text-white">
        <span
          className={cn(
            'inline-flex min-h-[44px] items-center gap-1.5 rounded-md px-1 text-[11px] font-semibold',
            available ? 'text-emerald-300' : 'text-white/55',
          )}
          aria-label={`Staff marked ${item.name} ${available ? 'in stock' : 'not in stock'}`}
        >
          {available ? (
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <EyeOff className="h-3.5 w-3.5" aria-hidden />
          )}
          {available ? 'Staff: in stock' : 'Staff: not in stock'}
        </span>

        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onEdit}
            disabled={!onEdit}
            aria-label={`Edit ${item.name}`}
            className="h-10 w-10 text-white/55 hover:bg-white/10 hover:text-white"
          >
            <Pencil className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            disabled={!onDelete}
            aria-label={`Remove ${item.name}`}
            className="h-10 w-10 text-white/45 hover:bg-red-500/20 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>
    </article>
  );
}

function CompactCard({
  item,
  quantity,
  onAdd,
  onRemove,
  maxQuantity,
  onEdit,
  onDelete,
  className,
}: FoodProductCardProps & { maxQuantity: number }) {
  const available = item.available !== false;

  return (
    <article
      className={cn(
        'flex min-w-0 items-center gap-3 rounded-xl border border-amber-900/10 bg-[#FFFDF7] p-2.5 shadow-[0_1px_2px_rgba(120,80,20,0.05)]',
        className,
      )}
      aria-label={item.name}
    >
      <div className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-lg bg-[#171008] ring-1 ring-black/5">
        <FoodImage
          src={item.imageUrl}
          name={item.name}
          imageClassName={cn(!available && 'saturate-[0.7]')}
          fallbackClassName="bg-[#171008]"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-[13.5px] font-semibold tracking-tight text-slate-900">
              {item.name}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-[10.5px] text-slate-500">
              {item.description?.trim() || item.category?.trim() || 'Campus kitchen'}
            </p>
          </div>
          <FoodPrice price={item.price} />
        </div>
        <div className="mt-1.5 flex min-h-[32px] items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CategoryChip category={item.category} tone="light" />
            {!onAdd && (onEdit || onDelete) ? (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-[10px] font-semibold',
                  available ? 'text-emerald-700' : 'text-slate-400',
                )}
              >
                {available ? 'Staff: in stock' : 'Staff: not in stock'}
              </span>
            ) : null}
          </div>

          {onAdd ? (
            <StudentActions
              name={item.name}
              quantity={quantity ?? 0}
              onAdd={onAdd}
              onRemove={onRemove}
              maxQuantity={maxQuantity}
              available={available}
              fullWidth={false}
            />
          ) : onEdit || onDelete ? (
            <div className="flex items-center gap-0.5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onEdit}
                disabled={!onEdit}
                aria-label={`Edit ${item.name}`}
                className="h-8 w-8"
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={onDelete}
                disabled={!onDelete}
                aria-label={`Remove ${item.name}`}
                className="h-8 w-8 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

/**
 * The signature Kupon food card: full-bleed dish imagery, warm dark scrim,
 * overlaid name/description/price and an unmistakable order action.
 *
 * - `student` — photo-led menu card with add/quantity controls (student menu).
 * - `vendor`  — catalog card with staff-reported stock state and owner actions.
 * - `compact` — horizontal row for list mode, carts and mobile previews.
 */
export function FoodProductCard({
  variant = 'student',
  maxQuantity = FOOD_QUANTITY_MAX,
  ...props
}: FoodProductCardProps) {
  if (variant === 'vendor') return <VendorCard {...props} />;
  if (variant === 'compact') return <CompactCard {...props} maxQuantity={maxQuantity} />;
  return <StudentCard {...props} maxQuantity={maxQuantity} />;
}
