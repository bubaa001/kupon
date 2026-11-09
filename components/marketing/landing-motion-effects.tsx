'use client';

import { useEffect } from 'react';

export function LandingMotionEffects() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const nav = document.querySelector<HTMLElement>('.landing-nav');
    let frame = 0;

    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scrollable = document.documentElement.scrollHeight - window.innerHeight;
        const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
        document.documentElement.style.setProperty('--landing-scroll-progress', String(progress));
        document.documentElement.style.setProperty(
          '--landing-parallax',
          `${Math.min(window.scrollY * 0.08, 54)}px`,
        );
        nav?.classList.toggle('is-scrolled', window.scrollY > 16);
      });
    };

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update, { passive: true });
    update();
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (frame) window.cancelAnimationFrame(frame);
      document.documentElement.style.removeProperty('--landing-scroll-progress');
      document.documentElement.style.removeProperty('--landing-parallax');
      nav?.classList.remove('is-scrolled');
    };
  }, []);

  return null;
}
