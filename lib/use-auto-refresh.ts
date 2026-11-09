'use client';

import { useEffect, useRef } from 'react';

export const DEFAULT_AUTO_REFRESH_MS = 15_000;

export function useAutoRefresh(
  refresh: () => void,
  intervalMs = DEFAULT_AUTO_REFRESH_MS,
  enabled = true,
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;

    let lastRefreshAt = Date.now();
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRefreshAt < 1_000) return;
      lastRefreshAt = Date.now();
      refreshRef.current();
    };

    const interval = window.setInterval(refreshWhenVisible, intervalMs);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    window.addEventListener('focus', refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
      window.removeEventListener('focus', refreshWhenVisible);
    };
  }, [enabled, intervalMs]);
}
