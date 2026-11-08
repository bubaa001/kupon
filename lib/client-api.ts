'use client';

/**
 * Small typed fetch client shared by every role UI.
 * Throws `ApiClientError` with the human message returned by the server so pages
 * can display real errors instead of a generic toast.
 */
export class ApiClientError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

type Envelope<T> =
  | { ok: true; data: T }
  | { ok: false; error: { message: string; code: string; details?: unknown } };

export async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    cache: 'no-store',
  });

  let payload: Envelope<T> | null = null;
  try {
    payload = (await response.json()) as Envelope<T>;
  } catch {
    throw new ApiClientError('The server returned an unreadable response.', 'BAD_RESPONSE', response.status);
  }

  if (!response.ok || !payload.ok) {
    const error = payload && !payload.ok ? payload.error : null;
    throw new ApiClientError(
      error?.message ?? 'Request failed. Please try again.',
      error?.code ?? 'REQUEST_FAILED',
      response.status,
      error?.details,
    );
  }

  return payload.data;
}

export function postJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'POST', body: JSON.stringify(body) });
}

export function patchJson<T>(url: string, body: unknown): Promise<T> {
  return apiFetch<T>(url, { method: 'PATCH', body: JSON.stringify(body) });
}

export function deleteJson<T>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: 'DELETE' });
}
