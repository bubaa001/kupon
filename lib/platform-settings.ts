import { prisma } from '@/lib/db';
import {
  API_PAYOUT_FEE,
  KUPON_TRANSACTION_FEE_PERCENT,
  MIN_WITHDRAWAL,
  VENDOR_PAYOUT_FEE,
} from '@/lib/constants';

/**
 * Kupon-wide money settings that platform admins change from the dashboard.
 * The constants in lib/constants.ts are only the defaults used before an admin
 * saves a value. Snippe's own charges (2.5% to the payer, TZS 1,500 per payout)
 * are fixed by the provider and are not settings.
 */
export type FeeSettings = {
  /** Kupon's cut of each order's food amount, in percent. */
  kuponFeePercent: number;
  /** What a cafeteria is charged per withdrawal, in TZS. Includes Snippe's payout fee. */
  withdrawalFee: number;
  /** Smallest withdrawal a cafeteria may request, in TZS. */
  minWithdrawal: number;
};

export const FEE_DEFAULTS: FeeSettings = {
  kuponFeePercent: KUPON_TRANSACTION_FEE_PERCENT,
  withdrawalFee: VENDOR_PAYOUT_FEE,
  minWithdrawal: MIN_WITHDRAWAL,
};

/** Limits enforced on save so a typo cannot charge cafeterias absurd amounts. */
export const FEE_LIMITS = {
  kuponFeePercent: { min: 0, max: 10 },
  // Never below Snippe's own payout fee, or Kupon pays the difference.
  withdrawalFee: { min: API_PAYOUT_FEE, max: 20_000 },
  minWithdrawal: { min: 10_000, max: 1_000_000 },
} as const;

const KEYS = Object.keys(FEE_DEFAULTS) as Array<keyof FeeSettings>;

export async function getFeeSettings(): Promise<FeeSettings> {
  const rows = await prisma.platformSetting.findMany({ where: { key: { in: KEYS } } });
  const settings = { ...FEE_DEFAULTS };
  for (const row of rows) {
    const value = Number(row.value);
    if (Number.isFinite(value)) settings[row.key as keyof FeeSettings] = value;
  }
  return settings;
}

/** Kupon's share of one withdrawal charge after Snippe takes its payout fee. */
export function kuponPayoutShare(settings: FeeSettings): number {
  return Math.max(0, settings.withdrawalFee - API_PAYOUT_FEE);
}

export async function saveFeeSettings(
  next: FeeSettings,
  actorId: string,
): Promise<FeeSettings> {
  await prisma.$transaction(
    KEYS.map((key) =>
      prisma.platformSetting.upsert({
        where: { key },
        create: { key, value: String(next[key]), updatedById: actorId },
        update: { value: String(next[key]), updatedById: actorId },
      }),
    ),
  );
  return next;
}
