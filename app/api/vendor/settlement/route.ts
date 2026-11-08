import { subDays } from 'date-fns';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { badRequest, conflict, notFound, tooManyRequests } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { formatTZS, randomReference } from '@/lib/utils';
import {
  API_PAYOUT_FEE,
  KUPON_PAYOUT_FEE,
  MIN_WITHDRAWAL,
  VENDOR_PAYOUT_FEE,
} from '@/lib/constants';
import { paymentSelect, saleRow, studentSummarySelect } from '../_lib/analytics';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const settlementRequestSchema = z.object({
  // Omit `amount` to settle the full pending balance.
  amount: z
    .number()
    .int('Enter a whole shilling amount')
    .min(MIN_WITHDRAWAL, `Minimum payout is TZS ${MIN_WITHDRAWAL.toLocaleString()}`)
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

    const [snapshot, payouts, recentPayments] = await Promise.all([
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
    ]);

    if (!snapshot) throw notFound('Vendor account no longer exists.');

    return ok({
      pendingBalance: snapshot.pendingBalance,
      totalSettled: snapshot.totalSettled,
      settlementAccount: snapshot.settlementAccount,
      minimumPayout: MIN_WITHDRAWAL,
      payoutFee: VENDOR_PAYOUT_FEE,
      apiFee: API_PAYOUT_FEE,
      kuponFee: KUPON_PAYOUT_FEE,
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

/**
 * POST /api/vendor/settlement
 *
 * Test settlement: updates the vendor's simulated balances and records the
 * settlement plus an audit log in ONE transaction. No payout is sent. The
 * `pendingBalance: { gte: amount }` guard makes double payout impossible even if
 * two requests race — the losing request rolls back with a 409.
 */
export async function POST(request: Request) {
  try {
    const { user, vendor, universityId } = await requireVendorAccess();

    const limit = rateLimit(`vendor-settlement:${vendor.id}`, 6, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many payout requests. Wait a minute before requesting another settlement.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, settlementRequestSchema);

    const snapshot = await prisma.vendor.findUnique({
      where: { id: vendor.id },
      select: {
        pendingBalance: true,
        settlementAccount: true,
        universityId: true,
      },
    });
    if (!snapshot) throw notFound('Vendor account no longer exists.');
    if (snapshot.universityId !== universityId) {
      throw notFound('Vendor account no longer exists.');
    }
    if (snapshot.pendingBalance <= 0) {
      throw conflict('There is no pending balance yet. Sales appear here after the first scan.');
    }
    if (snapshot.pendingBalance < MIN_WITHDRAWAL) {
      throw conflict(
        `Withdrawals are available once your balance reaches TZS ${MIN_WITHDRAWAL.toLocaleString()}.`,
      );
    }

    const amount = body.amount ?? snapshot.pendingBalance;
    if (amount > snapshot.pendingBalance) {
      throw conflict(
        `Only ${formatTZS(snapshot.pendingBalance)} is available to settle right now.`,
      );
    }
    if (amount <= 0) throw badRequest('Settlement amount must be greater than zero.');
    if (amount < MIN_WITHDRAWAL) {
      throw badRequest(`Minimum payout is TZS ${MIN_WITHDRAWAL.toLocaleString()}.`);
    }
    const netAmount = amount - VENDOR_PAYOUT_FEE;

    const lastPayout = await prisma.settlement.findFirst({
      where: { vendorId: vendor.id },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, paidAt: true },
    });
    const now = new Date();
    const periodStart = lastPayout
      ? (lastPayout.paidAt ?? lastPayout.createdAt)
      : subDays(now, 7);

    const result = await prisma.$transaction(async (tx) => {
      // Conditional decrement is the double-payout lock. Never skip this guard.
      const applied = await tx.vendor.updateMany({
        where: { id: vendor.id, pendingBalance: { gte: amount } },
        data: {
          pendingBalance: { decrement: amount },
          totalSettled: { increment: netAmount },
        },
      });
      if (applied.count === 0) {
        throw conflict('Your pending balance just changed. Refresh and try again.');
      }

      const settlement = await tx.settlement.create({
        data: {
          reference: randomReference('STL'),
          vendorId: vendor.id,
          universityId,
          amount,
          feeAmount: VENDOR_PAYOUT_FEE,
          apiFee: API_PAYOUT_FEE,
          kuponFee: KUPON_PAYOUT_FEE,
          netAmount,
          status: 'SIMULATED',
          periodStart,
          periodEnd: now,
          paidAt: now,
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId,
          action: 'VENDOR_TEST_SETTLEMENT_RECORDED',
          entity: 'Settlement',
          entityId: settlement.id,
          metadata: {
            reference: settlement.reference,
            amount,
            feeAmount: VENDOR_PAYOUT_FEE,
            apiFee: API_PAYOUT_FEE,
            kuponFee: KUPON_PAYOUT_FEE,
            netAmount,
            vendorCode: vendor.code,
            settlementAccount: snapshot.settlementAccount,
            mode: 'internal-test-simulation',
          },
        },
        tx,
      );

      const updated = await tx.vendor.findUnique({
        where: { id: vendor.id },
        select: { pendingBalance: true, totalSettled: true },
      });

      return {
        settlement: {
          id: settlement.id,
          reference: settlement.reference,
          amount: settlement.amount,
          feeAmount: settlement.feeAmount,
          apiFee: settlement.apiFee,
          kuponFee: settlement.kuponFee,
          netAmount: settlement.netAmount,
          status: settlement.status,
          periodStart: settlement.periodStart.toISOString(),
          periodEnd: settlement.periodEnd.toISOString(),
          paidAt: settlement.paidAt ? settlement.paidAt.toISOString() : null,
          createdAt: settlement.createdAt.toISOString(),
        },
        pendingBalance: updated?.pendingBalance ?? 0,
        totalSettled: updated?.totalSettled ?? 0,
        settlementAccount: snapshot.settlementAccount,
        message: `Test settlement recorded for ${formatTZS(amount)} less a ${formatTZS(VENDOR_PAYOUT_FEE)} fee (${formatTZS(API_PAYOUT_FEE)} API + ${formatTZS(KUPON_PAYOUT_FEE)} Kupon). ${formatTZS(netAmount)} was recorded; no money was sent to ${snapshot.settlementAccount}.`,
      };
    });

    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
