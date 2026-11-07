import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { failAzamPayTopUp, settleAzamPayTopUp } from '@/lib/payments/azampay';
import { failOrderCheckout, settleOrderCheckout } from '@/lib/orders/settle-checkout';
import { safeJson } from '@/lib/utils';

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
    body.externalId ??
      body.externalid ??
      body.externalreference ??
      body.reference ??
      body.utilityref ??
      '',
  ).trim();
  const status = String(
    body.transactionstatus ?? body.transactionStatus ?? body.status ?? '',
  ).toLowerCase();
  const rawAzamTransactionId = body.transactionId ?? body.transid;
  const azamTransactionId =
    typeof rawAzamTransactionId === 'string' || typeof rawAzamTransactionId === 'number'
      ? String(rawAzamTransactionId)
      : null;

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
        type: { in: ['TOPUP', 'PAYMENT'] },
      },
      select: { reference: true, type: true, metadata: true },
    });
    const metadata = safeJson<Record<string, unknown>>(transaction?.metadata, {});
    const isOrderCheckout =
      transaction?.type === 'PAYMENT' && metadata.channel === 'MOBILE_MONEY_ORDER';
    if (!transaction || (transaction.type !== 'TOPUP' && !isOrderCheckout)) {
      return NextResponse.json({ error: 'Payment not found.' }, { status: 404 });
    }

    if (status === 'success' || status === 'successful' || status === 'completed') {
      if (isOrderCheckout) {
        await settleOrderCheckout({
          reference: transaction.reference,
          providerTransactionId: azamTransactionId,
        });
      } else {
        await settleAzamPayTopUp({
          reference: transaction.reference,
          azampayTransactionId: azamTransactionId,
        });
      }
    } else if (status === 'failed' || status === 'rejected' || status === 'cancelled') {
      if (isOrderCheckout) {
        await failOrderCheckout(transaction.reference, `Mobile-money payment ${status}`);
      } else {
        await failAzamPayTopUp(transaction.reference, `AzamPay ${status}`);
      }
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
