'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, apiFetch } from '@/lib/client-api';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type ApiState<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
};

/**
 * Tiny data hook shared by the admin pages: abortable fetches, retry, and a
 * session-expiry redirect so a stale tab never shows a silent empty dashboard.
 */
export function useApiData<T>(url: string | null) {
  const [state, setState] = useState<ApiState<T>>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    if (!url) {
      setState({ data: null, error: null, loading: false });
      return;
    }

    const id = requestId.current + 1;
    requestId.current = id;
    const controller = new AbortController();
    setState((previous) => ({ ...previous, loading: true, error: null }));

    apiFetch<T>(url, { signal: controller.signal })
      .then((data) => {
        if (requestId.current === id) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId.current !== id) return;
        if (error instanceof ApiClientError && error.status === 401) {
          window.location.assign('/login');
          return;
        }
        setState({
          data: null,
          error: error instanceof Error ? error.message : 'Could not load this data.',
          loading: false,
        });
      });

    return () => controller.abort();
  }, [url, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);
  useAutoRefresh(reload, undefined, url !== null);
  const setData = useCallback(
    (updater: T | ((current: T | null) => T | null)) =>
      setState((previous) => ({
        ...previous,
        data:
          typeof updater === 'function'
            ? (updater as (current: T | null) => T | null)(previous.data)
            : updater,
      })),
    [],
  );

  return { ...state, reload, setData };
}

export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

/** Builds a query string, dropping empty values so the API defaults apply. */
export function queryString(values: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}
