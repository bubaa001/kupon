import { env } from '@/lib/env';

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

/**
 * Fee waterfall for a campus sale:
 *
 *   gross amount
 *     − platformFee (2.5%)         → university share + aggregator + Kupon net
 *     = vendorSettlement (97.5%)
 *
 * Within the 2.5% platform fee:
 *   − aggregatorFee (1.5%)
 *   − universityRevenue (0.5%, i.e. 40% of the fee)
 *   = platformNet (0.5%)
 *
 * All figures are integer TZS. `platformNet` is clamped at zero for very small
 * transactions so a rounding edge can never produce a negative revenue line.
 */
export function calcPaymentFees(amount: number): PaymentFees {
  const gross = Math.max(0, Math.round(amount));
  const platformFee = Math.round((gross * env.PLATFORM_FEE_PERCENT) / 100);
  const rawAggregator = Math.round((gross * env.AGGREGATOR_FEE_PERCENT) / 100);
  const universityRevenue = Math.round(
    (platformFee * env.UNIVERSITY_REVENUE_SHARE_PERCENT) / 100,
  );
  const aggregatorFee = Math.min(
    rawAggregator,
    Math.max(0, platformFee - universityRevenue),
  );
  const platformNet = Math.max(0, platformFee - universityRevenue - aggregatorFee);
  const vendorSettlement = gross - platformFee;

  return {
    platformFee,
    aggregatorFee,
    universityRevenue,
    platformNet,
    vendorSettlement,
  };
}

/** Cost of the mobile-money cash-in rail, absorbed by the platform on top-ups. */
export function calcAggregatorCost(amount: number): number {
  return Math.round((Math.max(0, amount) * env.AGGREGATOR_FEE_PERCENT) / 100);
}
