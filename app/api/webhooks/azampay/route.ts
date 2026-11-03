import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { failAzamPayTopUp, settleAzamPayTopUp } from '@/lib/payments/azampay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * AzamPay collection callback.
 *
 * AzamPay collection callbacks are not signed like Whop webhooks, so the
 * callback URL contains an unguessable token (AZAMPAY_CALLBACK_TOKEN). For
 * production, also reconcile against AzamPay settlement reports before
 * releasing vendor payouts.
 */
export async function POST(request: Request) {
  const expected = env.AZAMPAY_CALLBACK_TOKEN;
  const provided = new URL(request.url).searchParams.get('token');
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: 'Invalid callback token.' }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid callback body.' }, { status: 400 });
  }

  const reference = String(
    body.externalId ?? body.externalid ?? body.utilityref ?? body.reference ?? '',
  ).trim();
  const status = String(
    body.transactionstatus ?? body.transactionStatus ?? body.status ?? '',
  ).toLowerCase();
  const azamTransactionId =
    typeof body.transactionId === 'string' ? body.transactionId : null;

  if (!reference) {
    return NextResponse.json({ error: 'Missing transaction reference.' }, { status: 400 });
  }

  try {
    const transaction = await prisma.transaction.findFirst({
      where: {
        OR: [
          { reference },
          { metadata: { contains: reference } },
        ],
        type: 'TOPUP',
      },
      select: { reference: true },
    });
    if (!transaction) {
      return NextResponse.json({ error: 'Top-up not found.' }, { status: 404 });
    }

    if (status === 'success' || status === 'successful' || status === 'completed') {
      await settleAzamPayTopUp({
        reference: transaction.reference,
        azampayTransactionId: azamTransactionId,
      });
    } else if (status === 'failed' || status === 'rejected' || status === 'cancelled') {
      await failAzamPayTopUp(transaction.reference, `AzamPay ${status}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[azampay:callback] failed', error);
    return NextResponse.json({ error: 'Callback processing failed.' }, { status: 500 });
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
