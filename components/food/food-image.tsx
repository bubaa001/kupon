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
    <div className={cn('relative h-full w-full overflow-hidden bg-[#171008]', className)}>
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
            'relative flex h-full w-full items-center justify-center overflow-hidden bg-[#171008]',
            fallbackClassName,
          )}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_15%,rgba(251,191,36,0.3),transparent_55%),radial-gradient(circle_at_80%_85%,rgba(16,185,129,0.24),transparent_55%)]"
          />
          <span
            aria-hidden
            className="absolute aspect-square w-[48%] rounded-full border border-white/[0.07] bg-white/[0.04] shadow-[inset_0_2px_26px_rgba(0,0,0,0.35)]"
          />
          <UtensilsCrossed aria-hidden className="relative h-7 w-7 text-white/30" />
        </div>
      )}
    </div>
  );
}
