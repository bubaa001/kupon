import { NextResponse } from 'next/server';
import { unwrapWebhook } from '@whop/sdk/helpers';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { failWhopTopUp, settleWhopTopUp } from '@/lib/payments/whop';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type WhopPaymentEvent = {
  type: string;
  data: {
    id?: string;
    metadata?: Record<string, unknown>;
    checkout_configuration_id?: string | null;
    status?: string;
  };
};

/**
 * Whop webhook receiver.
 *
 * Signature verification uses the Standard Webhooks helper. The raw request
 * body must never be parsed before verification. Only `payment.succeeded`
 * credits a student wallet; every event is idempotent because settlement is
 * guarded by the PENDING -> SETTLED conditional update.
 */
export async function POST(request: Request) {
  if (!env.WHOP_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Whop webhook is not configured.' }, { status: 503 });
  }

  let event: WhopPaymentEvent;
  try {
    const payload = await request.text();
    event = unwrapWebhook<WhopPaymentEvent>(payload, {
      headers: Object.fromEntries(request.headers.entries()),
      key: env.WHOP_WEBHOOK_SECRET,
    });
  } catch (error) {
    console.error('[whop:webhook] signature verification failed', error);
    return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
  }

  try {
    if (event.type === 'payment.succeeded') {
      const payment = event.data;
      const reference = await resolveReference(payment);
      if (reference && payment.id) {
        await settleWhopTopUp({
          reference,
          paymentId: payment.id,
          checkoutId: payment.checkout_configuration_id ?? null,
        });
      }
    } else if (event.type === 'payment.failed' || event.type === 'payment.canceled') {
      const reference = await resolveReference(event.data);
      if (reference) {
        await failWhopTopUp(reference, `Whop ${event.type}`);
      }
    }

    // Whop requires a 2xx response quickly; settlement is already committed.
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[whop:webhook] handler failed', error);
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}

async function resolveReference(payment: WhopPaymentEvent['data']): Promise<string | null> {
  const direct = payment.metadata?.kupon_transaction ?? payment.metadata?.kupon_reference;
  if (typeof direct === 'string' && direct.length > 0) return direct;

  if (payment.checkout_configuration_id) {
    const transaction = await prisma.transaction.findFirst({
      where: {
        type: 'TOPUP',
        metadata: { contains: payment.checkout_configuration_id },
      },
      select: { reference: true },
    });
    if (transaction) return transaction.reference;
  }

  return null;
}
