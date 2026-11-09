import { subDays } from 'date-fns';
import { auditLog } from '@/lib/audit';
import { conflict, forbidden } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { API_PAYOUT_FEE, KUPON_PAYOUT_FEE, MIN_WITHDRAWAL, VENDOR_PAYOUT_FEE } from '@/lib/constants';
import { formatTZS, randomReference } from '@/lib/utils';

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
  if (input.emergencyLimit !== undefined && amount > input.emergencyLimit) {
    throw conflict(`This emergency withdrawal exceeds the admin-authorized limit of ${formatTZS(input.emergencyLimit)}.`);
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
          emergencyWithdrawalLimit: { gte: amount },
        },
        data: { emergencyWithdrawalLimit: { increment: 0 } },
      });
      if (!authorized.count) {
        throw forbidden('The admin-authorized emergency withdrawal limit is insufficient or disabled.');
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
        status: 'SIMULATED',
        periodStart,
        periodEnd: now,
        paidAt: now,
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
          mode: 'internal-test-simulation',
          settlementAccount: snapshot.settlementAccount,
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
      settlementAccount: snapshot.settlementAccount,
      message: `Test settlement recorded for ${formatTZS(amount)} less a ${formatTZS(VENDOR_PAYOUT_FEE)} fee. ${formatTZS(netAmount)} is recorded; no money was sent to ${snapshot.settlementAccount}.`,
    };
  });
  return result;
}
