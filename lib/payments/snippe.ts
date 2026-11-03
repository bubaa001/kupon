import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { calcPaymentFees } from '@/lib/fees';
import { postJournal, LEDGER_ACCOUNTS } from '@/lib/ledger';
import { creditWallet, debitWallet } from '@/lib/wallet';
import { AppError, conflict, notFound } from '@/lib/errors';
import { randomReference, safeJson } from '@/lib/utils';
import { paymentSms, sendSms, topUpSms } from '@/lib/sms';
import type {
  PaymentProvider,
  TopUpRequest,
  TopUpResult,
  WithdrawalPayoutRequest,
  WithdrawalPayoutResult,
} from './types';

/**
 * Snippe mock payment aggregator.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REPLACE THIS MOCK WITH A REAL AGGREGATOR
 * ─────────────────────────────────────────────────────────────────────────────
 * Real Selcom / AzamPay / N-Card integrations follow this exact shape:
 *
 *   1. `initiateTopUp` POSTs to the aggregator's collection endpoint with the
 *      university's Lipa Namba (`paymentRouteCode`) and the payer MSISDN.
 *   2. The aggregator sends an asynchronous webhook (usually within 2–10s).
 *      Add `/api/webhooks/payments` with signature verification and call
 *      `settleTopUp(transaction.id)` only after the webhook is verified.
 *   3. `settlePayment` verifies a campus payment; `initiateWithdrawal` pushes an
 *      approved student cash-out to their mobile-money wallet via the aggregator's
 *      payout API. Order refunds never leave the platform, so they have no rail call.
 *
 * Never credit a wallet from a client-side redirect. Only a verified webhook or
 * server-to-server status check may settle money.
 */
class SnippeMockProvider implements PaymentProvider {
  readonly name = 'Snippe (mock)';

  private settledTimers = new Set<string>();

  async initiateTopUp(input: TopUpRequest): Promise<TopUpResult> {
    const university = await prisma.university.findUnique({
      where: { id: input.universityId },
      select: { id: true, paymentRouteCode: true, status: true, code: true },
    });
    if (!university) throw notFound('University not found.');
    if (university.status !== 'ACTIVE') {
      throw conflict('This university is temporarily suspended. Top-ups are disabled.');
    }

    const student = await prisma.studentProfile.findUnique({
      where: { id: input.studentProfileId },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!student || student.universityId !== input.universityId) {
      throw new AppError('Student and university do not match.', 403, 'TENANT_MISMATCH');
    }

    const reference = randomReference('TOP');
    // The mock cash-in is free. A real Selcom/AzamPay/N-Card collection costs
    // ~1.5%; decide whether to absorb it here or pass a convenience fee to the
    // student. We leave it at zero so the demo P&L reconciles to the documented
    // 2.5% / 1.5% payment split only.
    const aggregatorFee = 0;

    const transaction = await prisma.transaction.create({
      data: {
        reference,
        universityId: university.id,
        studentId: student.id,
        amount: input.amount,
        fee: 0,
        aggregatorFee,
        type: 'TOPUP',
        status: 'PENDING',
        phone: input.phone,
        network: input.network,
        routeCode: university.paymentRouteCode,
        metadata: JSON.stringify({
          provider: 'snippe-mock',
          universityCode: university.code,
          routeCode: university.paymentRouteCode,
          lipaNamba: university.paymentRouteCode,
          aggregatorRef: `SNP-${reference}`,
          note: 'Replace this mock with a real Selcom/AzamPay/N-Card STK push.',
        }),
      },
    });

    this.scheduleSettlement(transaction.id);

    return {
      transactionId: transaction.id,
      reference,
      status: 'PENDING',
      provider: this.name,
      routeCode: university.paymentRouteCode,
      message: `USSD push sent to ${input.phone}. Enter your ${input.network} PIN to confirm.`,
      aggregatorFee,
    };
  }

  /**
   * Simulates the aggregator callback. Safe to call repeatedly; the updateMany
   * guard makes settlement exactly-once.
   */
  async settleTopUp(transactionId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
      });
      if (!transaction) throw notFound('Top-up transaction not found.');
      if (transaction.type !== 'TOPUP') {
        throw new AppError('Only top-up transactions can be settled by this method.', 400);
      }
      if (transaction.status === 'SETTLED') {
        return { alreadySettled: true, balance: null as number | null, transaction };
      }
      if (transaction.status === 'FAILED') {
        throw conflict('This top-up already failed and cannot be settled.');
      }

      const claimed = await tx.transaction.updateMany({
        where: { id: transactionId, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
      if (claimed.count === 0) {
        return { alreadySettled: true, balance: null as number | null, transaction };
      }

      const balance = await creditWallet(tx, transaction.studentId, transaction.amount);

      await postJournal(tx, {
        transactionId: transaction.id,
        universityId: transaction.universityId,
        description: 'Mobile-money top-up settled',
        lines: [
          {
            account: LEDGER_ACCOUNTS.CASH_TRUST,
            debit: transaction.amount,
            description: 'Cash received from mobile-money aggregator',
          },
          {
            account: LEDGER_ACCOUNTS.STUDENT_WALLET,
            credit: transaction.amount,
            description: 'Student wallet credited',
          },
        ],
      });

      return { alreadySettled: false, balance, transaction };
    });

    if (!result.alreadySettled && result.transaction.phone) {
      await sendSms(
        result.transaction.phone,
        topUpSms(result.transaction.amount, result.transaction.reference),
      );
    }

    return {
      transactionId,
      status: 'SETTLED',
      balance: result.balance ?? undefined,
    };
  }

  /**
   * Settles a PENDING campus payment: debits the student wallet, credits vendor
   * pending settlement, books university/platform/aggregator revenue and writes
   * a balanced journal — all in one database transaction.
   */
  async settlePayment(transactionId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const transaction = await tx.transaction.findUnique({
        where: { id: transactionId },
        include: {
          student: { include: { user: { select: { name: true, phone: true } } } },
          vendor: true,
          university: { select: { code: true, paymentRouteCode: true } },
        },
      });
      if (!transaction) throw notFound('Payment transaction not found.');
      if (transaction.type !== 'PAYMENT') {
        throw new AppError('Only PAYMENT transactions can be settled here.', 400);
      }
      if (transaction.status === 'SETTLED') {
        return { transaction, balance: null as number | null, alreadySettled: true };
      }
      if (transaction.status === 'FAILED') {
        throw conflict('This payment failed and cannot be settled.');
      }
      if (!transaction.vendor) throw notFound('Vendor not found for this payment.');
      if (transaction.vendor.universityId !== transaction.universityId) {
        throw new AppError('Cross-tenant payment blocked.', 403, 'TENANT_MISMATCH');
      }
      if (transaction.vendor.status !== 'ACTIVE') {
        throw conflict('This vendor is suspended and cannot accept payments.');
      }

      const claimed = await tx.transaction.updateMany({
        where: { id: transaction.id, status: 'PENDING' },
        data: { status: 'SETTLED', settledAt: new Date() },
      });
      if (claimed.count === 0) {
        return { transaction, balance: null as number | null, alreadySettled: true };
      }

      // Conditional debit prevents concurrent scans from overdrawing the wallet.
      const balance = await debitWallet(tx, transaction.studentId, transaction.amount);
      const fees = calcPaymentFees(transaction.amount);

      await tx.vendor.update({
        where: { id: transaction.vendor.id },
        data: { pendingBalance: { increment: fees.vendorSettlement } },
      });

      await tx.transaction.update({
        where: { id: transaction.id },
        data: {
          fee: fees.platformFee,
          platformFee: fees.platformFee,
          aggregatorFee: fees.aggregatorFee,
          universityRevenue: fees.universityRevenue,
          vendorSettlement: fees.vendorSettlement,
          metadata: JSON.stringify({
            ...safeJson<Record<string, unknown>>(transaction.metadata, {}),
            routeCode: transaction.routeCode,
            lipaNamba: transaction.university.paymentRouteCode,
            fees,
            provider: 'snippe-mock',
          }),
        },
      });

      await postJournal(tx, {
        transactionId: transaction.id,
        universityId: transaction.universityId,
        description: `Cafeteria payment • ${transaction.vendor.name}`,
        lines: [
          {
            account: LEDGER_ACCOUNTS.STUDENT_WALLET,
            debit: transaction.amount,
            description: 'Student wallet debited',
          },
          {
            account: LEDGER_ACCOUNTS.VENDOR_PENDING,
            credit: fees.vendorSettlement,
            description: 'Vendor pending settlement credited',
          },
          {
            account: LEDGER_ACCOUNTS.UNIVERSITY_REVENUE,
            credit: fees.universityRevenue,
            description: 'University fee share',
          },
          {
            account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE,
            credit: fees.aggregatorFee,
            description: 'Aggregator rail cost',
          },
          {
            account: LEDGER_ACCOUNTS.PLATFORM_REVENUE,
            credit: fees.platformNet,
            description: 'Kupon net platform revenue',
          },
        ],
      });

      return { transaction, balance, alreadySettled: false };
    });

    if (!result.alreadySettled && result.transaction.student.user.phone) {
      await sendSms(
        result.transaction.student.user.phone,
        paymentSms(
          result.transaction.amount,
          result.transaction.vendor?.name ?? 'Kupon vendor',
          result.balance ?? 0,
        ),
      );
    }

    return {
      transactionId,
      status: 'SETTLED',
      balance: result.balance ?? undefined,
      transaction: result.transaction,
    };
  }

  async markFailed(transactionId: string, reason: string) {
    await prisma.transaction.updateMany({
      where: { id: transactionId, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: reason },
    });
  }

  /**
   * Mock mobile-money disbursement for an approved wallet withdrawal.
   *
   * The wallet debit, WITHDRAWAL transaction and balanced journal are written
   * before this call by `lib/payments/withdrawal.ts`; this method represents only
   * the external payout leg. A production aggregator must treat `reference` as an
   * idempotency key and confirm asynchronously through a signed webhook.
   */
  async initiateWithdrawal(
    input: WithdrawalPayoutRequest,
  ): Promise<WithdrawalPayoutResult> {
    const student = await prisma.studentProfile.findUnique({
      where: { id: input.studentProfileId },
      include: {
        user: { select: { phone: true } },
        university: { select: { id: true, code: true, paymentRouteCode: true, status: true } },
      },
    });
    if (!student) throw notFound('Student not found.');
    if (student.universityId !== input.universityId) {
      throw new AppError('Cross-tenant withdrawal blocked.', 403, 'TENANT_MISMATCH');
    }
    if (student.university.status !== 'ACTIVE') {
      throw conflict('University is suspended. Withdrawals are paused.');
    }

    // The mock rail always settles synchronously. Swap this for the aggregator's
    // payout API; keep the returned reference stable so the admin audit trail and
    // the student's transaction history can be reconciled.
    return {
      reference: input.reference,
      status: 'SETTLED',
      provider: this.name,
      routeCode: student.university.paymentRouteCode,
      message: `Payout of TZS ${input.amount.toLocaleString('en-US')} queued to ${input.phone}.`,
    };
  }

  private scheduleSettlement(transactionId: string) {
    if (env.MOCK_SETTLEMENT_DELAY_MS <= 0) {
      void this.settleTopUp(transactionId).catch((error) => {
        console.error('[snippe:mock] immediate settlement failed', error);
      });
      return;
    }

    if (this.settledTimers.has(transactionId)) return;
    this.settledTimers.add(transactionId);
    const timer = setTimeout(() => {
      this.settledTimers.delete(transactionId);
      void this.settleTopUp(transactionId).catch((error) => {
        console.error('[snippe:mock] scheduled settlement failed', error);
      });
    }, env.MOCK_SETTLEMENT_DELAY_MS);
    // Serverless keeps timers only for the life of the invocation; the lazy
    // `settleStaleTopUps` sweep covers the (likely) case the instance is frozen.
    timer.unref?.();
  }

  /**
   * Lazily settles top-ups whose 2-second mock window has passed. Called by the
   * wallet and transaction APIs so the UI is correct even if a timer was lost.
   */
  async settleStaleTopUps(studentProfileId?: string) {
    const cutoff = new Date(Date.now() - env.MOCK_SETTLEMENT_DELAY_MS);
    const stale = await prisma.transaction.findMany({
      where: {
        type: 'TOPUP',
        status: 'PENDING',
        // Whop/AzamPay collections settle only through their verified callback;
        // the mock timer must never credit a real rail that has not paid.
        NOT: {
          OR: [
            { network: 'WHOP' },
            { metadata: { contains: '"provider":"azampay"' } },
          ],
        },
        createdAt: { lte: cutoff },
        ...(studentProfileId ? { studentId: studentProfileId } : {}),
      },
      select: { id: true },
      take: 25,
      orderBy: { createdAt: 'asc' },
    });

    for (const item of stale) {
      try {
        await this.settleTopUp(item.id);
      } catch (error) {
        console.error(`[snippe:mock] stale top-up ${item.id} failed to settle`, error);
      }
    }
    return stale.length;
  }
}

const provider = new SnippeMockProvider();

export const snippeMock = provider;
export default provider;
