import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { randomReference, safeJson } from '@/lib/utils';
import { creditWallet } from '@/lib/wallet';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { conflict, notFound } from '@/lib/errors';

/**
 * AzamPay sandbox/live mobile-money collection.
 *
 * AzamPay is the closest fit for Kupon: M-Pesa, Tigo, Airtel and Halopesa push
 * straight to the student's phone. The Kupon wallet is still settled locally
 * after AzamPay confirms the collection.
 *
 * The callback URL must include the unguessable AZAMPAY_CALLBACK_TOKEN because
 * AzamPay's collection callback is not signed like Whop's. For production, also
 * reconcile against AzamPay settlement reports before releasing payouts.
 */
export type AzamPayConfig = {
  clientId: string;
  clientSecret: string;
  apiKey?: string;
  appName: string;
  environment: 'sandbox' | 'production';
  authBase: string;
  checkoutBase: string;
};

export function getAzamPayConfig(): AzamPayConfig | null {
  if (
    !env.AZAMPAY_CLIENT_ID ||
    !env.AZAMPAY_CLIENT_SECRET ||
    !env.AZAMPAY_APP_NAME
  ) {
    return null;
  }
  const sandbox = env.AZAMPAY_ENVIRONMENT === 'sandbox';
  return {
    clientId: env.AZAMPAY_CLIENT_ID,
    clientSecret: env.AZAMPAY_CLIENT_SECRET,
    apiKey: env.AZAMPAY_API_KEY || undefined,
    appName: env.AZAMPAY_APP_NAME,
    environment: sandbox ? 'sandbox' : 'production',
    authBase: sandbox
      ? 'https://authenticator-sandbox.azampay.co.tz'
      : 'https://authenticator.azampay.co.tz',
    checkoutBase: sandbox ? 'https://sandbox.azampay.co.tz' : 'https://checkout.azampay.co.tz',
  };
}

export function isAzamPayEnabled(): boolean {
  return getAzamPayConfig() !== null;
}

type CachedToken = { token: string; expiresAt: number };
let tokenCache: CachedToken | null = null;

async function getAccessToken(config: AzamPayConfig): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.token;
  const response = await fetch(`${config.authBase}/AppRegistration/GenerateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appName: config.appName,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    }),
    cache: 'no-store',
  });
  const payload = (await response.json()) as {
    data?: { accessToken?: string; expire?: string };
    message?: string;
  };
  if (!response.ok || !payload.data?.accessToken) {
    throw new Error(payload.message ?? 'AzamPay authentication failed.');
  }
  tokenCache = {
    token: payload.data.accessToken,
    expiresAt: payload.data.expire ? new Date(payload.data.expire).getTime() : Date.now() + 3_000_000,
  };
  return payload.data.accessToken;
}

function providerFor(network: string): string {
  switch (network) {
    case 'TIGO_PESA':
      return 'Tigo';
    case 'AIRTEL_MONEY':
      return 'Airtel';
    case 'HALOTEL':
      return 'Halopesa';
    case 'M-PESA':
    default:
      return 'Mpesa';
  }
}

function normalizePhone(phone: string): string {
  // AzamPay's MNO collection examples use the local 0XXXXXXXXX format.
  // Sending 255XXXXXXXXX can be accepted with HTTP 200 but not route to the
  // handset in sandbox, which looks like a missing USSD push.
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('255')) return `0${digits.slice(3)}`;
  if (digits.startsWith('0')) return digits;
  if (digits.length === 9) return `0${digits}`;
  return digits;
}

export type AzamPayTopUpResult = {
  transactionId: string;
  reference: string;
  status: 'PENDING';
  provider: string;
  routeCode: string;
  message: string;
  aggregatorFee: number;
};

export async function initiateAzamPayTopUp(input: {
  universityId: string;
  studentProfileId: string;
  amount: number;
  phone: string;
  network: string;
}): Promise<AzamPayTopUpResult> {
  const config = getAzamPayConfig();
  if (!config) throw conflict('AzamPay is not configured.');

  const university = await prisma.university.findUnique({
    where: { id: input.universityId },
    select: { paymentRouteCode: true, status: true, code: true },
  });
  if (!university || university.status !== 'ACTIVE') {
    throw conflict('This university is not accepting top-ups right now.');
  }

  const reference = randomReference('TOP');
  const provider = providerFor(input.network);
  const transaction = await prisma.transaction.create({
    data: {
      reference,
      universityId: input.universityId,
      studentId: input.studentProfileId,
      amount: input.amount,
      fee: 0,
      aggregatorFee: 0,
      type: 'TOPUP',
      status: 'PENDING',
      phone: normalizePhone(input.phone),
      network: provider.toUpperCase(),
      routeCode: university.paymentRouteCode,
      metadata: JSON.stringify({
        provider: 'azampay',
        channel: 'AZAMPAY_MNO',
        externalId: reference,
        providerName: provider,
        universityCode: university.code,
        routeCode: university.paymentRouteCode,
        lipaNamba: university.paymentRouteCode,
      }),
    },
  });

  try {
    const accessToken = await getAccessToken(config);
    const response = await fetch(`${config.checkoutBase}/azampay/mno/checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        ...(config.apiKey ? { 'X-API-Key': config.apiKey } : {}),
      },
      body: JSON.stringify({
        accountNumber: normalizePhone(input.phone),
        amount: String(input.amount),
        currency: 'TZS',
        externalId: reference,
        provider,
      }),
      cache: 'no-store',
    });
    const payload = (await response.json()) as {
      success?: boolean;
      transactionId?: string;
      message?: string;
    };
    if (!response.ok || payload.success === false) {
      throw new Error(payload.message ?? `AzamPay checkout failed (${response.status}).`);
    }

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        metadata: JSON.stringify({
          ...safeJson<Record<string, unknown>>(transaction.metadata, {}),
          azampayTransactionId: payload.transactionId ?? null,
        }),
      },
    });

    return {
      transactionId: transaction.id,
      reference,
      status: 'PENDING',
      provider: 'AzamPay',
      routeCode: university.paymentRouteCode,
      message: `AzamPay imepokea ombi lako kwa ${normalizePhone(input.phone)}. Angalia simu yako kwa ombi la uthibitisho.`,
      aggregatorFee: 0,
    };
  } catch (error) {
    await prisma.transaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: {
        status: 'FAILED',
        failureReason: error instanceof Error ? error.message : 'AzamPay checkout failed',
      },
    });
    throw error;
  }
}

/** Called from the token-protected AzamPay callback after a successful status. */
export async function settleAzamPayTopUp(input: {
  reference: string;
  azampayTransactionId?: string | null;
}): Promise<{ settled: boolean; balance: number | null }> {
  const transaction = await prisma.transaction.findUnique({
    where: { reference: input.reference },
  });
  if (!transaction || transaction.type !== 'TOPUP') {
    throw notFound('Top-up transaction not found.');
  }
  if (transaction.status === 'SETTLED') return { settled: false, balance: null };
  if (transaction.status === 'FAILED') throw conflict('This top-up already failed.');

  return prisma.$transaction(async (tx) => {
    const claimed = await tx.transaction.updateMany({
      where: { id: transaction.id, status: 'PENDING' },
      data: {
        status: 'SETTLED',
        settledAt: new Date(),
        metadata: JSON.stringify({
          ...safeJson<Record<string, unknown>>(transaction.metadata, {}),
          provider: 'azampay',
          azampayTransactionId: input.azampayTransactionId ?? null,
          azampaySettledAt: new Date().toISOString(),
        }),
      },
    });
    if (claimed.count === 0) return { settled: false, balance: null };

    const balance = await creditWallet(tx, transaction.studentId, transaction.amount);
    await postJournal(tx, {
      transactionId: transaction.id,
      universityId: transaction.universityId,
      description: 'AzamPay mobile-money top-up settled',
      lines: [
        {
          account: LEDGER_ACCOUNTS.CASH_TRUST,
          debit: transaction.amount,
          description: 'Cash received from AzamPay',
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

export async function failAzamPayTopUp(reference: string, reason: string) {
  await prisma.transaction.updateMany({
    where: { reference, type: 'TOPUP', status: 'PENDING' },
    data: { status: 'FAILED', failureReason: reason },
  });
}
