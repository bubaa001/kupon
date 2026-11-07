'use client';

import { useEffect, useRef } from 'react';

export function MarketingReveal({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !('IntersectionObserver' in window)
    ) {
      element.dataset.visible = 'true';
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          element.dataset.visible = 'true';
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );

    element.dataset.reveal = 'true';
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  return <div ref={ref}>{children}</div>;
}
