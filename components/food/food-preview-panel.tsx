'use client';

import { Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FoodProductCard, type FoodProduct } from './food-product-card';

/**
 * The live "how students will see it" panel used by the add/edit food dialog.
 * Renders the real student card (compact on phones, full photo card on desktop)
 * so every change — name, price, photo, availability — is visible immediately.
 */
export function FoodPreviewPanel({
  item,
  quantity,
  onAdd,
  onRemove,
  className,
}: {
  item: FoodProduct;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  className?: string;
}) {
  const hidden = item.available === false;

  return (
    <div
      className={cn(
        'rounded-2xl border border-amber-900/10 bg-[#FBF6EA] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-900/60">
          Live preview
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-emerald-700 ring-1 ring-emerald-100">
          <Eye className="h-2.5 w-2.5" aria-hidden />
          Student view
        </span>
      </div>

      <div className="mt-2.5 lg:hidden">
        <FoodProductCard
          variant="compact"
          item={item}
          quantity={quantity}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>
      <div className="mt-2.5 hidden lg:block">
        <FoodProductCard
          variant="student"
          item={item}
          quantity={quantity}
          onAdd={onAdd}
          onRemove={onRemove}
        />
      </div>

      <p className="mt-2 inline-flex items-start gap-1.5 text-[10px] leading-relaxed text-amber-900/55">
        <span aria-hidden className="mt-[3px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500/70" />
        Tap + to try the student add flow. Preview only — nothing is ordered.
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-amber-900/[0.07] pt-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em]',
            hidden
              ? 'bg-slate-100 text-slate-500'
              : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
          )}
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full', hidden ? 'bg-slate-400' : 'bg-emerald-500')}
            aria-hidden
          />
          {hidden ? 'Hidden from students' : 'Live for students'}
        </span>
        <span className="text-[10px] text-amber-900/55">Saves instantly — no approval step.</span>
      </div>
    </div>
  );
}
