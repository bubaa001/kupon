import { prisma } from '@/lib/db';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { MIN_WITHDRAWAL } from '@/lib/constants';
import { withdrawalRequestSchema } from '@/lib/validators';
import { snippeMock } from '@/lib/payments/snippe';
import {
  moneyRequestInclude,
  serializeStudentMoneyRequest,
} from '@/lib/payments/money-requests';
import { formatTZS, randomReference } from '@/lib/utils';
import type { WithdrawalCreated, WithdrawalsData } from '@/app/student/_lib/types';
import { getStudentBalance, getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/student/withdrawals
 *
 * Cash-out history plus how much of the available wallet balance can be withdrawn
 * right now. This endpoint is WITHDRAWAL-only: it never returns or creates an
 * order refund. A pending request blocks a second one (one review at a time).
 */
export async function GET() {
  try {
    const { student } = await getStudentContext();
    await snippeMock.settleStaleTopUps(student.id);

    const [requests, balance] = await Promise.all([
      prisma.refundRequest.findMany({
        where: { studentId: student.id, kind: 'WITHDRAWAL' },
        include: moneyRequestInclude,
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      getStudentBalance(student.id),
    ]);

    const hasPending = requests.some((request) => request.status === 'PENDING');
    const eligibleAmount =
      !hasPending && balance >= MIN_WITHDRAWAL ? balance : 0;

    const data: WithdrawalsData = {
      requests: requests.map(serializeStudentMoneyRequest),
      balance,
      eligibleAmount,
      hasPending,
      minAmount: MIN_WITHDRAWAL,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

/**
 * POST /api/student/withdrawals
 *
 * Records a cash-out request only. No money moves here: an admin reviews it and
 * only approval debits the wallet exactly once and pays out to mobile money.
 */
export async function POST(request: Request) {
  try {
    const { user, student } = await getStudentContext();

    const limit = rateLimit(`student:withdrawal:${user.id}`, 5, 10 * 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many withdrawal requests. Please wait a few minutes before trying again.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, withdrawalRequestSchema);
    await snippeMock.settleStaleTopUps(student.id);

    const [profile, pending] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { id: student.id },
        select: {
          universityId: true,
          walletBalance: true,
          wallet: { select: { balance: true } },
        },
      }),
      prisma.refundRequest.findFirst({
        where: { studentId: student.id, kind: 'WITHDRAWAL', status: 'PENDING' },
      }),
    ]);

    if (!profile) throw notFound('Student wallet not found.');
    const balance = profile.wallet?.balance ?? profile.walletBalance;

    if (pending) {
      throw conflict(
        'You already have a withdrawal awaiting review. Wait for the admin decision before requesting another cash-out.',
        { requestId: pending.id, amount: pending.amount },
      );
    }

    if (body.amount > balance) {
      throw conflict(
        `You cannot withdraw more than your available balance of ${formatTZS(balance)}.`,
        { available: balance, requested: body.amount },
      );
    }

    const created = await prisma.refundRequest.create({
      data: {
        reference: randomReference('WDR'),
        kind: 'WITHDRAWAL',
        studentId: student.id,
        universityId: profile.universityId,
        amount: body.amount,
        reason: body.reason,
        status: 'PENDING',
      },
      include: moneyRequestInclude,
    });

    const data: WithdrawalCreated = {
      request: serializeStudentMoneyRequest(created),
      message:
        'Ombi lako la kutoa pesa limewasilishwa. Admin wa chuo atakagua; ikikubaliwa, pesa itatumwa kwenye mobile money yako mara moja.',
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
