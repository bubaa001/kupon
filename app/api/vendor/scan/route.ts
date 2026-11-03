import { fail, ok, parseJson } from '@/lib/api';
import { badRequest, tooManyRequests } from '@/lib/errors';
import { resolvePaymentToken } from '@/lib/qr';
import { rateLimit } from '@/lib/rate-limit';
import { displayName } from '@/lib/utils';
import { validateTokenSchema } from '@/lib/validators';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/vendor/scan
 * Step 1 of the POS flow: exchange a QR JWT (or the 6-digit fallback code) for
 * the paying student's summary. Does NOT consume the token — a separate,
 * idempotent charge call consumes it atomically.
 */
export async function POST(request: Request) {
  try {
    const { vendor, universityId } = await requireVendorAccess();

    const limit = rateLimit(`vendor-scan:${vendor.id}`, 60, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many scans in the last minute. Wait a moment before trying again.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, validateTokenSchema);
    if (!body.token && !body.code) {
      throw badRequest('Scan a student QR code or enter their 6-digit payment code.');
    }

    const resolved = await resolvePaymentToken({
      token: body.token,
      code: body.code,
      vendorUniversityId: universityId,
    });

    const expiresIn = Math.max(
      0,
      Math.ceil((resolved.expiresAt.getTime() - Date.now()) / 1000),
    );

    return ok({
      student: {
        name: resolved.student.name,
        maskedName: displayName(resolved.student.name),
        studentNumber: resolved.student.studentNumber,
        course: resolved.student.course,
        walletBalance: resolved.student.walletBalance,
        university: resolved.student.university,
      },
      token: {
        code: resolved.code,
        expiresAt: resolved.expiresAt.toISOString(),
      },
      expiresIn,
    });
  } catch (error) {
    return fail(error);
  }
}
