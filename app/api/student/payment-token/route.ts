import { z } from 'zod';
import { prisma } from '@/lib/db';
import { fail, ok, searchParams } from '@/lib/api';
import type { TxStatus } from '@/lib/constants';
import { badRequest, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { createPaymentToken } from '@/lib/qr';
import { snippeMock } from '@/lib/payments/snippe';
import type {
  PaymentTokenCreated,
  PaymentTokenStatusData,
} from '@/app/student/_lib/types';
import { getStudentBalance, getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.object({ id: z.string().trim().min(1, 'Payment code is required') });

/**
 * POST /api/student/payment-token
 *
 * Creates a 120-second, single-use QR/JWT + 6-digit code. No body is required:
 * everything is derived from the session. Rate limited because regenerating
 * codes is cheap for the client but should not be free for an abuser.
 */
export async function POST() {
  try {
    const { user, student } = await getStudentContext();
    if (!user.universityId) {
      throw badRequest('Your account is not linked to a university.');
    }

    const limit = rateLimit(`student:payment-token:${user.id}`, 10, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many payment codes requested. Wait a moment before trying again.',
        limit.retryAfterSeconds,
      );
    }

    await snippeMock.settleStaleTopUps(student.id);

    const [token, balance] = await Promise.all([
      createPaymentToken({
        studentProfileId: student.id,
        universityId: user.universityId,
        studentName: user.name,
        studentNumber: student.studentId,
      }),
      getStudentBalance(student.id),
    ]);

    const data: PaymentTokenCreated = {
      tokenId: token.tokenId,
      token: token.token,
      code: token.code,
      expiresAt: token.expiresAt,
      expiresIn: token.expiresIn,
      student: { name: token.student.name, studentId: token.student.studentId },
      balance,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

/**
 * GET /api/student/payment-token?id=
 *
 * Polled while the QR is on screen. Once a vendor consumes the token the
 * transaction is returned so the student sees who charged them and how much.
 */
export async function GET(request: Request) {
  try {
    const { student } = await getStudentContext();
    const params = searchParams(request);
    const { id } = idSchema.parse({ id: params.get('id') ?? '' });

    const record = await prisma.paymentToken.findUnique({
      where: { id },
      include: {
        transaction: {
          include: { vendor: { select: { name: true, code: true } } },
        },
      },
    });

    if (!record || record.studentId !== student.id) {
      throw notFound('This payment code was not found.');
    }

    const status: PaymentTokenStatusData['status'] = record.usedAt
      ? 'USED'
      : record.expiresAt.getTime() <= Date.now()
        ? 'EXPIRED'
        : 'ACTIVE';

    const data: PaymentTokenStatusData = {
      status,
      expiresAt: record.expiresAt.toISOString(),
      transaction: record.transaction
        ? {
            vendor: record.transaction.vendor
              ? {
                  name: record.transaction.vendor.name,
                  code: record.transaction.vendor.code,
                }
              : null,
            amount: record.transaction.amount,
            status: record.transaction.status as TxStatus,
            createdAt: record.transaction.createdAt.toISOString(),
          }
        : undefined,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
