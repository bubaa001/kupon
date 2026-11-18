import { NextResponse } from 'next/server';
import { auditLog } from '@/lib/audit';
import { prisma } from '@/lib/db';
import { failOrderCheckout, settleOrderCheckout } from '@/lib/orders/settle-checkout';
import { snippeEnabled, verifySnippeWebhook } from '@/lib/payments/snippe';
import { safeJson } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type SnippeEvent = {
  event?: string;
  type?: string;
  data?: {
    reference?: string;
    status?: string;
    failure_reason?: string;
    metadata?: { kupon_reference?: string };
  };
};

/** Finds our payment from the reference we sent, or from Snippe's own reference. */
async function findKuponReference(event: SnippeEvent): Promise<string | null> {
  const ours = event.data?.metadata?.kupon_reference;
  if (ours) return ours;
  const theirs = event.data?.reference;
  if (!theirs) return null;
  const payment = await prisma.transaction.findFirst({
    where: { type: 'PAYMENT', isTest: false, metadata: { contains: `"snippeReference":"${theirs}"` } },
    select: { reference: true },
  });
  return payment?.reference ?? null;
}

/**
 * POST /api/webhooks/snippe
 * Snippe tells us when a payment completes or fails. The signature is checked
 * before anything is read, and handling is idempotent because Snippe may
 * deliver the same event more than once.
 */
export async function POST(request: Request) {
  if (!snippeEnabled()) {
    return NextResponse.json({ ok: false, error: 'Snippe is not enabled.' }, { status: 404 });
  }
  const raw = await request.text();
  const valid = verifySnippeWebhook(
    raw,
    request.headers.get('x-webhook-timestamp'),
    request.headers.get('x-webhook-signature'),
  );
  if (!valid) return NextResponse.json({ ok: false, error: 'Invalid signature.' }, { status: 401 });

  const event = safeJson<SnippeEvent>(raw, {});
  const name = request.headers.get('x-webhook-event') ?? event.event ?? event.type ?? '';

  try {
    if (name.startsWith('payment.')) {
      const reference = await findKuponReference(event);
      if (!reference) return NextResponse.json({ ok: true, ignored: 'unknown payment' });
      if (name === 'payment.completed') {
        await settleOrderCheckout({ reference });
      } else if (name === 'payment.failed' || name === 'payment.voided') {
        await failOrderCheckout({
          reference,
          reason: event.data?.failure_reason ?? 'The payment was not approved.',
          stage: 'FAILED',
        });
      } else if (name === 'payment.expired') {
        await failOrderCheckout({ reference, reason: 'The payment request expired.', stage: 'EXPIRED' });
      }
    } else if (name.startsWith('payout.')) {
      await auditLog({
        action: `SNIPPE_${name.replace('.', '_').toUpperCase()}`,
        entity: 'Payout',
        entityId: event.data?.metadata?.kupon_reference ?? event.data?.reference ?? null,
        metadata: { reference: event.data?.reference ?? null, status: event.data?.status ?? null },
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    // A payment already handled is fine; anything else is retried by Snippe.
    const message = error instanceof Error ? error.message : 'Webhook failed';
    if (/already|no longer/i.test(message)) return NextResponse.json({ ok: true, note: message });
    console.error('[kupon] snippe webhook', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
