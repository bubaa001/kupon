import { startOfDay, subDays } from 'date-fns';
import { auditLog } from '@/lib/audit';
import { AppError, conflict, forbidden } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { API_PAYOUT_FEE } from '@/lib/constants';
import { getFeeSettings, kuponPayoutShare } from '@/lib/platform-settings';
import { formatTZS, randomReference, safeJson } from '@/lib/utils';
import { kuponBaseUrl, sendSnippePayout, snippeEnabled } from '@/lib/payments/snippe';
import { formatPayoutAccount, parsePayoutAccount, snippeRecipient } from '@/lib/payouts/payout-account';

export async function recordTestSettlement(input: {
  actorId: string;
  vendorId: string;
  universityId: string;
  amount?: number;
  emergencyReason?: string;
  emergencyLimit?: number;
}) {
  const snapshot = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: {
      pendingBalance: true,
      settlementAccount: true,
      universityId: true,
      name: true,
      code: true,
    },
  });
  if (!snapshot || snapshot.universityId !== input.universityId) {
    throw conflict('Vendor account no longer exists in this university.');
  }
  // Live mode sends real money through Snippe; otherwise the withdrawal is only recorded.
  const live = snippeEnabled();
  const payoutAccount = parsePayoutAccount(snapshot.settlementAccount);
  if (live && !payoutAccount) {
    throw conflict('Add where withdrawals go (mobile money or bank) on the cafeteria profile first.');
  }
  const accountLabel = formatPayoutAccount(snapshot.settlementAccount);
  const fees = await getFeeSettings();
  const MIN_WITHDRAWAL = fees.minWithdrawal;
  const VENDOR_PAYOUT_FEE = fees.withdrawalFee;
  const KUPON_PAYOUT_FEE = kuponPayoutShare(fees);
  if (snapshot.pendingBalance <= 0) {
    throw conflict('There is no pending balance yet.');
  }
  if (snapshot.pendingBalance < MIN_WITHDRAWAL) {
    throw conflict(`Settlements require at least TZS ${MIN_WITHDRAWAL.toLocaleString()}.`);
  }

  const amount = input.amount ?? snapshot.pendingBalance;
  if (amount > snapshot.pendingBalance) {
    throw conflict(`Only ${formatTZS(snapshot.pendingBalance)} is available to settle right now.`);
  }
  if (amount < MIN_WITHDRAWAL) {
    throw conflict(`Minimum settlement is TZS ${MIN_WITHDRAWAL.toLocaleString()}.`);
  }
  if (input.emergencyLimit !== undefined) {
    // The owner's limit is per day: count this Finance person's withdrawals since midnight.
    const today = await prisma.auditLog.findMany({
      where: {
        actorId: input.actorId,
        action: 'FINANCE_EMERGENCY_TEST_SETTLEMENT_RECORDED',
        createdAt: { gte: startOfDay(new Date()) },
      },
      select: { metadata: true },
    });
    const usedToday = today.reduce((sum, row) => {
      const value = Number(safeJson<{ amount?: unknown }>(row.metadata, {}).amount);
      return sum + (Number.isFinite(value) ? value : 0);
    }, 0);
    const remaining = Math.max(0, input.emergencyLimit - usedToday);
    if (amount > remaining) {
      throw conflict(
        `That is over your daily limit. You can withdraw ${formatTZS(remaining)} more today; ask the owner for more.`,
      );
    }
  }

  const netAmount = amount - VENDOR_PAYOUT_FEE;
  const lastPayout = await prisma.settlement.findFirst({
    where: { vendorId: input.vendorId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, paidAt: true },
  });
  const now = new Date();
  const periodStart = lastPayout
    ? lastPayout.paidAt ?? lastPayout.createdAt
    : subDays(now, 7);

  const result = await prisma.$transaction(async (tx) => {
    if (input.emergencyLimit !== undefined) {
      // Conditional write locks the grant so revocation cannot race this settlement.
      const authorized = await tx.user.updateMany({
        where: {
          id: input.actorId,
          role: 'FINANCE',
          managedVendorId: input.vendorId,
          universityId: input.universityId,
          emergencyWithdrawalLimit: { gte: 1 },
        },
        data: { emergencyWithdrawalLimit: { increment: 0 } },
      });
      if (!authorized.count) {
        throw forbidden('The cafeteria owner has turned off withdrawals for this account.');
      }
    }

    const applied = await tx.vendor.updateMany({
      where: {
        id: input.vendorId,
        universityId: input.universityId,
        pendingBalance: { gte: amount },
      },
      data: {
        pendingBalance: { decrement: amount },
        totalSettled: { increment: netAmount },
      },
    });
    if (!applied.count) {
      throw conflict('The available cafeteria balance changed. Refresh and try again.');
    }

    const settlement = await tx.settlement.create({
      data: {
        reference: randomReference('STL'),
        vendorId: input.vendorId,
        universityId: input.universityId,
        amount,
        feeAmount: VENDOR_PAYOUT_FEE,
        apiFee: API_PAYOUT_FEE,
        kuponFee: KUPON_PAYOUT_FEE,
        netAmount,
        status: live ? 'PENDING' : 'SIMULATED',
        periodStart,
        periodEnd: now,
        paidAt: live ? null : now,
      },
    });
    await auditLog(
      {
        actorId: input.actorId,
        universityId: input.universityId,
        action: input.emergencyReason
          ? 'FINANCE_EMERGENCY_TEST_SETTLEMENT_RECORDED'
          : 'VENDOR_TEST_SETTLEMENT_RECORDED',
        entity: 'Settlement',
        entityId: settlement.id,
        metadata: {
          reference: settlement.reference,
          amount,
          feeAmount: VENDOR_PAYOUT_FEE,
          apiFee: API_PAYOUT_FEE,
          kuponFee: KUPON_PAYOUT_FEE,
          netAmount,
          emergencyReason: input.emergencyReason ?? null,
          mode: live ? 'snippe-live' : 'internal-test-simulation',
          settlementAccount: accountLabel,
          vendorName: snapshot.name,
          vendorCode: snapshot.code,
        },
      },
      tx,
    );
    const updated = await tx.vendor.findUniqueOrThrow({
      where: { id: input.vendorId },
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
        paidAt: settlement.paidAt?.toISOString() ?? null,
        createdAt: settlement.createdAt.toISOString(),
      },
      pendingBalance: updated.pendingBalance,
      totalSettled: updated.totalSettled,
      settlementAccount: accountLabel,
      message: live
        ? `Sending ${formatTZS(netAmount)} to ${accountLabel} (${formatTZS(amount)} less a ${formatTZS(VENDOR_PAYOUT_FEE)} fee).`
        : `Test settlement recorded for ${formatTZS(amount)} less a ${formatTZS(VENDOR_PAYOUT_FEE)} fee. ${formatTZS(netAmount)} is recorded; no money was sent to ${accountLabel}.`,
    };
  });

  if (live && payoutAccount) {
    try {
      const payout = await sendSnippePayout({
        amount: netAmount,
        recipient: snippeRecipient(payoutAccount),
        kuponReference: result.settlement.reference,
        webhookUrl: `${kuponBaseUrl()}/api/webhooks/snippe`,
      });
      await auditLog({
        actorId: input.actorId,
        universityId: input.universityId,
        action: 'SNIPPE_PAYOUT_SENT',
        entity: 'Settlement',
        entityId: result.settlement.id,
        metadata: { reference: result.settlement.reference, snippeReference: payout.reference, status: payout.status },
      });
    } catch (error) {
      // Snippe refused it: nothing left our account, so give the balance back.
      await failSettlement(result.settlement.reference, error instanceof Error ? error.message : 'Payout failed');
      throw new AppError(
        'The payout could not be sent right now. Your balance was not touched. Try again in a few minutes.',
        502,
        'PAYOUT_FAILED',
      );
    }
  }
  return result;
}

/**
 * Marks a live payout failed and returns the money to the cafeteria balance.
 * Safe to call twice: only a PENDING or PAID settlement is reversed, once.
 */
export async function failSettlement(reference: string, reason: string) {
  return prisma.$transaction(async (tx) => {
    const settlement = await tx.settlement.findUnique({ where: { reference } });
    if (!settlement || settlement.status === 'SIMULATED') return false;
    const marked = await tx.settlement.updateMany({
      where: { id: settlement.id, status: { in: ['PENDING', 'PAID'] } },
      data: { status: 'FAILED', paidAt: null },
    });
    if (!marked.count) return false;
    await tx.vendor.update({
      where: { id: settlement.vendorId },
      data: {
        pendingBalance: { increment: settlement.amount },
        totalSettled: { decrement: settlement.netAmount },
      },
    });
    await auditLog(
      {
        universityId: settlement.universityId,
        action: 'SNIPPE_PAYOUT_FAILED',
        entity: 'Settlement',
        entityId: settlement.id,
        metadata: { reference, reason, restored: settlement.amount },
      },
      tx,
    );
    return true;
  });
}

/** Snippe confirmed the money arrived. */
export async function completeSettlement(reference: string) {
  const marked = await prisma.settlement.updateMany({
    where: { reference, status: 'PENDING' },
    data: { status: 'PAID', paidAt: new Date() },
  });
  return marked.count > 0;
}
