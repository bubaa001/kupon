'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker (offline page, image cache, push alerts).
 * Registers right away if the page has already finished loading; waiting for a
 * `load` event that already fired would mean it never registers at all.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('[kupon] Service worker registration failed', error);
      });
    };
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
