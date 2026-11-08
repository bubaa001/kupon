import { env } from '@/lib/env';
import {
  KUPON_TRANSACTION_FEE_PERCENT,
  STUDENT_PAYMENT_FEE_PERCENT,
} from '@/lib/constants';

export type PaymentFees = {
  /** Total fee retained from the vendor's gross sale. */
  platformFee: number;
  /** Cost of the payment rail, paid out of the platform fee. */
  aggregatorFee: number;
  /** University's share of the platform fee. */
  universityRevenue: number;
  /** Kupon's net platform revenue for this sale. */
  platformNet: number;
  /** Amount credited to the vendor's pending settlement. */
  vendorSettlement: number;
};

export type OrderCheckoutFees = {
  apiFee: number;
  kuponFee: number;
  vendorSettlement: number;
  amountCharged: number;
};

/** Checkout adds the API collection fee to the student's food total. */
export function calcOrderCheckoutFees(amountDue: number): OrderCheckoutFees {
  const cashDue = Math.max(0, Math.round(amountDue));
  const apiFee = Math.round((cashDue * STUDENT_PAYMENT_FEE_PERCENT) / 100);
  const kuponFee = Math.round((cashDue * KUPON_TRANSACTION_FEE_PERCENT) / 100);
  return {
    apiFee,
    kuponFee,
    vendorSettlement: cashDue - kuponFee,
    amountCharged: cashDue + apiFee,
  };
}

/** Legacy wallet-style payments retain only Kupon's 1% share. */
export function calcPaymentFees(amount: number): PaymentFees {
  const gross = Math.max(0, Math.round(amount));
  const platformFee = Math.round((gross * KUPON_TRANSACTION_FEE_PERCENT) / 100);
  const vendorSettlement = gross - platformFee;

  return {
    platformFee,
    aggregatorFee: 0,
    universityRevenue: 0,
    platformNet: platformFee,
    vendorSettlement,
  };
}

/** Cost of the mobile-money cash-in rail, absorbed by the platform on top-ups. */
export function calcAggregatorCost(amount: number): number {
  return Math.round((Math.max(0, amount) * env.AGGREGATOR_FEE_PERCENT) / 100);
}
