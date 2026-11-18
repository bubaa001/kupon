import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '@/lib/env';
import { AppError } from '@/lib/errors';

/**
 * Snippe (snippe.sh, by Neurotech Africa) payment API client.
 * Docs: https://docs.snippe.sh/docs/2026-01-25/payments
 *
 * Live payments are used only when PAYMENT_PROVIDER=snippe AND an API key and
 * webhook secret are configured. Otherwise Kupon keeps its internal test
 * gateway, so nothing changes for users until the switch is flipped.
 */
const BASE_URL = 'https://api.snippe.sh';

/** Public address Snippe calls back. Prefers NEXT_PUBLIC_APP_URL, then Vercel's production URL. */
export function kuponBaseUrl(): string {
  const configured = env.NEXT_PUBLIC_APP_URL;
  if (configured && !/localhost|127\.0\.0\.1/.test(configured)) return configured.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : configured.replace(/\/$/, '');
}

export function snippeEnabled(): boolean {
  return env.PAYMENT_PROVIDER === 'snippe' && Boolean(env.SNIPPE_API_KEY && env.SNIPPE_WEBHOOK_SECRET);
}

async function call<T>(path: string, init: RequestInit & { idempotencyKey?: string }): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.SNIPPE_API_KEY}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey.slice(0, 30) } : {}),
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    const message =
      (json as { message?: string; error?: { message?: string } } | null)?.message ??
      (json as { error?: { message?: string } } | null)?.error?.message ??
      `Snippe request failed (${response.status}).`;
    throw new AppError(message, response.status === 429 ? 429 : 502, 'SNIPPE_ERROR');
  }
  return json as T;
}

/** Tanzanian numbers in Snippe's 255XXXXXXXXX form. */
export function toSnippePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('255')) return digits;
  if (digits.startsWith('0')) return `255${digits.slice(1)}`;
  return digits.length === 9 ? `255${digits}` : digits;
}

type SnippePaymentResponse = { data?: { reference?: string; status?: string } } & {
  reference?: string;
  status?: string;
};

/** Starts a mobile-money collection: the buyer gets a USSD push to approve with their PIN. */
export async function createSnippePayment(input: {
  amount: number;
  phone: string;
  customer: { firstname: string; lastname: string; email: string };
  kuponReference: string;
  webhookUrl: string;
}): Promise<{ reference: string; status: string }> {
  const result = await call<SnippePaymentResponse>('/v1/payments', {
    method: 'POST',
    idempotencyKey: input.kuponReference,
    body: JSON.stringify({
      payment_type: 'mobile',
      details: { amount: input.amount, currency: 'TZS' },
      phone_number: toSnippePhone(input.phone),
      customer: input.customer,
      webhook_url: input.webhookUrl,
      metadata: { kupon_reference: input.kuponReference },
    }),
  });
  const reference = result.data?.reference ?? result.reference;
  if (!reference) throw new AppError('Snippe did not return a payment reference.', 502, 'SNIPPE_ERROR');
  return { reference, status: result.data?.status ?? result.status ?? 'pending' };
}

/** Sends money out to a cafeteria's mobile-money number or bank account. */
export async function sendSnippePayout(input: {
  amount: number;
  recipient: Record<string, unknown>;
  kuponReference: string;
  webhookUrl: string;
}): Promise<{ reference: string; status: string }> {
  const result = await call<SnippePaymentResponse>('/v1/payouts/send', {
    method: 'POST',
    idempotencyKey: input.kuponReference,
    body: JSON.stringify({
      amount: input.amount,
      ...input.recipient,
      narration: 'Kupon cafeteria withdrawal',
      webhook_url: input.webhookUrl,
      metadata: { kupon_reference: input.kuponReference },
    }),
  });
  const reference = result.data?.reference ?? result.reference;
  if (!reference) throw new AppError('Snippe did not return a payout reference.', 502, 'SNIPPE_ERROR');
  return { reference, status: result.data?.status ?? result.status ?? 'pending' };
}

const MAX_WEBHOOK_AGE_MS = 5 * 60_000;

/**
 * Checks a webhook really came from Snippe: HMAC-SHA256 of "{timestamp}.{raw body}"
 * with the webhook secret, hex encoded, and no older than 5 minutes.
 */
export function verifySnippeWebhook(rawBody: string, timestamp: string | null, signature: string | null): boolean {
  if (!env.SNIPPE_WEBHOOK_SECRET || !timestamp || !signature) return false;
  const seconds = Number(timestamp);
  const sentAt = Number.isFinite(seconds) ? (seconds > 1e12 ? seconds : seconds * 1000) : NaN;
  if (!Number.isFinite(sentAt) || Math.abs(Date.now() - sentAt) > MAX_WEBHOOK_AGE_MS) return false;
  const expected = createHmac('sha256', env.SNIPPE_WEBHOOK_SECRET).update(`${timestamp}.${rawBody}`).digest('hex');
  const given = signature.replace(/^sha256=/, '').trim();
  if (given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}
