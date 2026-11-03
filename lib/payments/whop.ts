import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { creditWallet } from '@/lib/wallet';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { conflict, notFound } from '@/lib/errors';
import { safeJson } from '@/lib/utils';

/**
 * Whop is the funding rail, not the student wallet. Each top-up creates a Whop
 * checkout configuration whose metadata carries the Kupon transaction
 * reference. A verified `payment.succeeded` webhook settles the pending TOPUP
 * transaction into the internal double-entry wallet.
 */
export type WhopConfig = {
  apiKey: string;
  accountId: string;
  productId: string;
  baseUrl: string;
};

export function getWhopConfig(): WhopConfig | null {
  if (!env.WHOP_API_KEY || !env.WHOP_ACCOUNT_ID || !env.WHOP_PRODUCT_ID) return null;
  return {
    apiKey: env.WHOP_API_KEY,
    accountId: env.WHOP_ACCOUNT_ID,
    productId: env.WHOP_PRODUCT_ID,
    baseUrl:
      env.WHOP_ENVIRONMENT === 'sandbox'
        ? 'https://sandbox-api.whop.com/api/v1'
        : 'https://api.whop.com/api/v1',
  };
}

export function isWhopEnabled(): boolean {
  return getWhopConfig() !== null;
}

async function whopRequest<T>(
  config: WhopConfig,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const response = await fetch(`${config.baseUrl}${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload && 'error' in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? response.statusText)
        : `Whop request failed (${response.status}).`;
    throw new Error(message);
  }

  return payload as T;
}

type WhopVariant = { id: string; purchase_url?: string | null };
type WhopCheckout = { id: string; purchase_url?: string | null };

/**
 * Creates a TZS amount variant + one hosted checkout. Returns the checkout URL.
 * The caller must create the PENDING TOPUP transaction first so the webhook has
 * a reference to settle.
 */
export async function createWhopCheckout(input: {
  amount: number;
  reference: string;
  studentId: string;
  universityId: string;
  redirectUrl: string;
}): Promise<{ checkoutId: string; checkoutUrl: string; variantId: string }> {
  const config = getWhopConfig();
  if (!config) throw conflict('Whop is not configured.');

  const variant = await whopRequest<WhopVariant>(config, '/variants', {
    method: 'POST',
    body: {
      account_id: config.accountId,
      product_id: config.productId,
      title: `Kupon top-up TZS ${input.amount.toLocaleString('en-US')}`,
      initial_price: input.amount,
      currency: 'tzs',
      billing_type: 'one_time',
      visibility: 'visible',
      metadata: { kupon_reference: input.reference },
    },
  });

  const checkout = await whopRequest<WhopCheckout>(config, '/checkout_configurations', {
    method: 'POST',
    body: {
      account_id: config.accountId,
      variant_id: variant.id,
      metadata: {
        kupon_transaction: input.reference,
        kupon_student: input.studentId,
        kupon_university: input.universityId,
      },
      redirect_url: input.redirectUrl,
    },
  });

  if (!checkout.purchase_url) {
    throw new Error('Whop did not return a checkout URL.');
  }

  return {
    checkoutId: checkout.id,
    checkoutUrl: checkout.purchase_url,
    variantId: variant.id,
  };
}

/** Settle a verified Whop payment exactly once into the internal wallet. */
export async function settleWhopTopUp(input: {
  reference: string;
  paymentId: string;
  checkoutId?: string | null;
}): Promise<{ settled: boolean; balance: number | null }> {
  const transaction = await prisma.transaction.findUnique({
    where: { reference: input.reference },
  });
  if (!transaction || transaction.type !== 'TOPUP') {
    throw notFound('Top-up transaction not found.');
  }
  if (transaction.status === 'SETTLED') {
    return { settled: false, balance: null };
  }
  if (transaction.status === 'FAILED') {
    throw conflict('This top-up already failed.');
  }

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        metadata: JSON.stringify({
          ...safeJson<Record<string, unknown>>(transaction.metadata, {}),
          provider: 'whop',
          whopPaymentId: input.paymentId,
          whopCheckoutId: input.checkoutId ?? null,
          whopSettledAt: new Date().toISOString(),
        }),
      },
    });
    if (claimed.count === 0) {
      return { settled: false, balance: null };
    }

    const balance = await creditWallet(tx, transaction.studentId, transaction.amount);
    await postJournal(tx, {
      transactionId: transaction.id,
      universityId: transaction.universityId,
      description: 'Whop card top-up settled',
      lines: [
        {
          account: LEDGER_ACCOUNTS.CASH_TRUST,
          debit: transaction.amount,
          description: 'Cash received from Whop',
        },
        {
          account: LEDGER_ACCOUNTS.STUDENT_WALLET,
          credit: transaction.amount,
          description: 'Student wallet credited',
        },
      ],
    });

    return { settled: true, balance };
  });
}

export async function failWhopTopUp(reference: string, reason: string) {
  await prisma.transaction.updateMany({
    where: { reference, type: 'TOPUP', status: 'PENDING' },
    data: { status: 'FAILED', failureReason: reason },
  });
}
