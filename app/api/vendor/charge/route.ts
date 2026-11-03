import { fail, ok, parseJson } from '@/lib/api';
import { badRequest, tooManyRequests } from '@/lib/errors';
import { chargeWithToken } from '@/lib/payments/charge';
import { rateLimit } from '@/lib/rate-limit';
import { displayName } from '@/lib/utils';
import { chargeSchema } from '@/lib/validators';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vendor/charge
 * Step 2 of the POS flow. `chargeWithToken()` owns the money movement: it
 * consumes the single-use token, debits the student wallet, credits the vendor
 * pending balance and writes the double-entry journal in one transaction.
 * The vendor identity always comes from the session — a client supplied
 * `vendorId` is ignored.
 */
export async function POST(request: Request) {
  try {
    const { vendor, universityId } = await requireVendorAccess();

    const limit = rateLimit(`vendor-charge:${vendor.id}`, 25, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'This till has processed a lot of payments in the last minute. Wait a few seconds before retrying.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, chargeSchema);
    if (!body.token && !body.code) {
      throw badRequest('Scan a student QR code or enter their 6-digit payment code.');
    }

    const charged = await chargeWithToken({
      token: body.token,
      code: body.code,
      amount: body.amount,
      vendorId: vendor.id,
      vendorUniversityId: universityId,
      note: body.note,
    });

    const transaction = charged.transaction;

    return ok({
      transaction: {
        id: transaction?.id ?? '',
        reference: transaction?.reference ?? '',
        amount: transaction?.amount ?? body.amount,
        status: transaction?.status ?? 'SETTLED',
        createdAt: (transaction?.createdAt ?? new Date()).toISOString(),
      },
      balance: charged.balance ?? 0,
      studentName: charged.studentName,
      studentMaskedName: displayName(charged.studentName),
      studentNumber: charged.studentNumber,
      vendor: charged.vendor,
      note: body.note ?? null,
    });
  } catch (error) {
    return fail(error);
  }
}
