import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { API_PAYOUT_FEE, STUDENT_PAYMENT_FEE_PERCENT } from '@/lib/constants';
import {
  FEE_DEFAULTS,
  FEE_LIMITS,
  getFeeSettings,
  kuponPayoutShare,
  saveFeeSettings,
} from '@/lib/platform-settings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const feeSchema = z
  .object({
    kuponFeePercent: z
      .number()
      .min(FEE_LIMITS.kuponFeePercent.min)
      .max(FEE_LIMITS.kuponFeePercent.max)
      .refine((value) => Number.isInteger(value * 100), 'Use at most two decimal places.'),
    withdrawalFee: z
      .number()
      .int()
      .min(FEE_LIMITS.withdrawalFee.min, `Must be at least Snippe's TZS ${API_PAYOUT_FEE.toLocaleString()} payout fee.`)
      .max(FEE_LIMITS.withdrawalFee.max),
    minWithdrawal: z.number().int().min(FEE_LIMITS.minWithdrawal.min).max(FEE_LIMITS.minWithdrawal.max),
  })
  .strict();

function describe(settings: Awaited<ReturnType<typeof getFeeSettings>>) {
  return {
    settings,
    defaults: FEE_DEFAULTS,
    limits: FEE_LIMITS,
    fixed: {
      snippeCollectionPercent: STUDENT_PAYMENT_FEE_PERCENT,
      snippePayoutFee: API_PAYOUT_FEE,
    },
    kuponPayoutShare: kuponPayoutShare(settings),
  };
}

/** GET/PATCH /api/super-admin/settings: Kupon's adjustable fees. */
export async function GET() {
  try {
    await requireApiUser(['SUPER_ADMIN']);
    return ok(describe(await getFeeSettings()));
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser(['SUPER_ADMIN']);
    const limit = await rateLimit(`super-admin:settings:${user.id}`, 20, 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many changes. Try again shortly.');
    const next = await parseJson(request, feeSchema);
    const previous = await getFeeSettings();
    await saveFeeSettings(next, user.id);
    await auditLog({
      actorId: user.id,
      action: 'PLATFORM_FEES_UPDATED',
      entity: 'PlatformSetting',
      entityId: 'fees',
      metadata: { previous, next },
    });
    return ok(describe(next));
  } catch (error) {
    return fail(error);
  }
}
