'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/client-api';

type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
};

/**
 * Small data-fetching hook for the platform console pages.
 *
 * Keeps the previous payload on screen while a manual refresh is in flight so
 * the console never flashes back to skeletons after the first load.
 */
export function useApiData<T>(url: string) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: true,
    refreshing: false,
  });
  const aliveRef = useRef(true);

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      setState((previous) => ({
        ...previous,
        loading: options?.silent ? previous.loading : previous.data === null,
        refreshing: Boolean(options?.silent),
        error: options?.silent ? previous.error : null,
      }));

      try {
        const data = await apiFetch<T>(url);
        if (!aliveRef.current) return;
        setState({ data, error: null, loading: false, refreshing: false });
      } catch (error) {
        if (!aliveRef.current) return;
        setState((previous) => ({
          ...previous,
          loading: false,
          refreshing: false,
          error:
            error instanceof Error
              ? error.message
              : 'Could not load platform data. Please try again.',
        }));
      }
    },
    [url],
  );

  useEffect(() => {
    aliveRef.current = true;
    void load();
    return () => {
      aliveRef.current = false;
    };
  }, [load]);

  return { ...state, reload: load };
}
