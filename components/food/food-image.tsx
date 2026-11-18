'use client';

import { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The image layer of a food product: the dish illustration when one is set,
 * otherwise a warm emoji tile. Keeps a single behaviour for broken image links
 * so every card, preview and picker falls back gracefully.
 */
export function FoodImage({
  src,
  name,
  className,
  imageClassName,
  fallbackClassName,
  priority = false,
}: {
  src?: string | null;
  name: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const showImage = Boolean(src) && !failed;
  // Illustration plates are composed on a fixed 4:3 canvas. Cropping them to a
  // tall photo card destroys the dish, so let the whole plate breathe. Photos
  // keep the appetising edge-to-edge crop.
  const isIllustration = Boolean(src && /\.svg($|\?)/i.test(src));

  return (
    <div className={cn('relative h-full w-full overflow-hidden bg-paper', className)}>
      {showImage ? (
        <img
          src={src ?? ''}
          alt={name}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full',
            isIllustration ? 'object-contain p-2' : 'object-cover',
            imageClassName,
          )}
        />
      ) : (
        <div
          className={cn(
            'relative flex h-full w-full items-center justify-center overflow-hidden bg-paper',
            fallbackClassName,
          )}
        >
          <span
            aria-hidden
            className="absolute aspect-square w-[46%] rounded-full border border-gold-200 bg-white"
          />
          <UtensilsCrossed aria-hidden className="relative h-7 w-7 text-gold-600/60" />
        </div>
      )}
    </div>
  );
}
