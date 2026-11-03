import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Food photo if the vendor uploaded one, otherwise a neutral dish placeholder.
 * Emoji fallbacks are intentionally gone: menus should use real food photos.
 */
export function FoodThumb({
  imageUrl,
  name,
  className,
}: {
  imageUrl?: string | null;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-amber-100 via-orange-50 to-emerald-100',
        className,
      )}
      aria-hidden
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt={name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <UtensilsCrossed className="h-4 w-4 text-amber-900/30" />
      )}
    </span>
  );
}
