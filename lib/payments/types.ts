/**
 * Payment rail abstraction.
 *
 * The student UI and wallet ledger only ever talk to this interface. Swapping
 * the mock Snippe implementation for Selcom, AzamPay, N-Card or a direct
 * Vodacom M-Pesa integration means adding a new class and changing
 * `getPaymentProvider()` in `lib/payments/index.ts` — no route or UI changes.
 *
 * IMPORTANT — two different money-return flows, two different methods:
 *
 * - `initiateWithdrawal()` is the mobile-money PAYOUT leg of a student cash-out.
 *   The wallet debit, WITHDRAWAL transaction and balanced journal are written by
 *   `lib/payments/withdrawal.ts` before this method is called; this method only
 *   talks to the external rail (and must support `reference` as an idempotency
 *   key so a retried payout can never pay twice).
 * - An order REFUND never leaves the platform: it reverses the original order
 *   payment into the student wallet. It lives in `lib/payments/order-refund.ts`
 *   and has no external payout call. The old `initiateRefund()` method was
 *   misnamed (it debited the wallet like a cash-out) and has been removed.
 */
export type TopUpRequest = {
  universityId: string;
  studentProfileId: string;
  amount: number;
  phone: string;
  network: string;
};

export type TopUpResult = {
  transactionId: string;
  reference: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  provider: string;
  routeCode: string;
  message: string;
  aggregatorFee: number;
};

/** One mobile-money disbursement for an approved wallet withdrawal. */
export type WithdrawalPayoutRequest = {
  /** Withdrawal reference. Reused as the aggregator idempotency key. */
  reference: string;
  universityId: string;
  studentProfileId: string;
  amount: number;
  /** Student mobile-money MSISDN (E.164). */
  phone: string;
  network?: string | null;
  actorId?: string;
};

export type WithdrawalPayoutResult = {
  /** Aggregator payout reference. Same as the input reference for idempotent rails. */
  reference: string;
  status: 'PENDING' | 'SETTLED' | 'FAILED';
  provider: string;
  routeCode: string;
  message: string;
};

export interface PaymentProvider {
  readonly name: string;
  initiateTopUp(input: TopUpRequest): Promise<TopUpResult>;
  settlePayment(
    transactionId: string,
  ): Promise<{ transactionId: string; status: string; balance?: number }>;
  /** Pay an approved withdrawal out to the student's mobile-money wallet. */
  initiateWithdrawal(input: WithdrawalPayoutRequest): Promise<WithdrawalPayoutResult>;
}
