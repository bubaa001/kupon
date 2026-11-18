import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { API_PAYOUT_FEE } from '@/lib/constants';
import { getFeeSettings, kuponPayoutShare } from '@/lib/platform-settings';
import { paymentSelect, saleRow, studentSummarySelect } from '../_lib/analytics';
import { requireVendorAccess } from '../_lib/access';
import { recordTestSettlement } from '@/lib/settlements/record-test-settlement';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settlementRequestSchema = z.object({
  // Omit `amount` to settle the full pending balance.
  amount: z
    .number()
    .int('Enter a whole shilling amount')
    .min(1)
    .max(5_000_000)
    .optional(),
});

/**
 * GET /api/vendor/settlement
 * Pending balance, lifetime settled total, payout history and the settled
 * payments that make up the current pending balance.
 */
export async function GET() {
  try {
    const { vendor, universityId } = await requireVendorAccess();

    const [snapshot, payouts, recentPayments, fees] = await Promise.all([
      prisma.vendor.findUnique({
        where: { id: vendor.id },
        select: {
          pendingBalance: true,
          totalSettled: true,
          settlementAccount: true,
          name: true,
          code: true,
        },
      }),
      prisma.settlement.findMany({
        where: { vendorId: vendor.id },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
      prisma.transaction.findMany({
        where: {
          vendorId: vendor.id,
          universityId,
          type: 'PAYMENT',
          status: 'SETTLED',
        },
        select: { ...paymentSelect, student: { select: studentSummarySelect } },
        orderBy: { settledAt: 'desc' },
        take: 8,
      }),
      getFeeSettings(),
    ]);

    if (!snapshot) throw notFound('Vendor account no longer exists.');

    return ok({
      pendingBalance: snapshot.pendingBalance,
      totalSettled: snapshot.totalSettled,
      settlementAccount: snapshot.settlementAccount,
      minimumPayout: fees.minWithdrawal,
      payoutFee: fees.withdrawalFee,
      apiFee: API_PAYOUT_FEE,
      kuponFee: kuponPayoutShare(fees),
      payouts: payouts.map((payout) => ({
        id: payout.id,
        reference: payout.reference,
        amount: payout.amount,
        status: payout.status,
        periodStart: payout.periodStart.toISOString(),
        periodEnd: payout.periodEnd.toISOString(),
        paidAt: payout.paidAt ? payout.paidAt.toISOString() : null,
        createdAt: payout.createdAt.toISOString(),
      })),
      recentPayments: recentPayments.map(saleRow),
    });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();

    const limit = await rateLimit(`vendor-settlement:${vendor.id}`, 6, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many payout requests. Wait a minute before requesting another settlement.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, settlementRequestSchema);
    const result = await recordTestSettlement({
      actorId: user.id,
      vendorId: vendor.id,
      universityId,
      amount: body.amount,
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
