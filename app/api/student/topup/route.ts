import { z } from 'zod';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, ok, parseJson, searchParams } from '@/lib/api';
import { badRequest, notFound, tooManyRequests } from '@/lib/errors';
import { randomReference } from '@/lib/utils';
import { externalUrl } from '@/lib/request-origin';
import { getPaymentProvider } from '@/lib/payments';
import { createWhopCheckout, getWhopConfig } from '@/lib/payments/whop';
import { getAzamPayConfig, initiateAzamPayTopUp } from '@/lib/payments/azampay';
import { snippeMock } from '@/lib/payments/snippe';
import { rateLimit } from '@/lib/rate-limit';
import { topUpSchema } from '@/lib/validators';
import type { TopUpCreated, TopUpStatusData } from '@/app/student/_lib/types';
import { getStudentBalance, getStudentContext } from '../_lib/student';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.object({ id: z.string().trim().min(1, 'Top-up reference is required') });

/**
 * POST /api/student/topup
 *
 * Creates a PENDING mobile-money collection through the configured payment
 * provider. The wallet is only credited by the provider's settlement path (the
 * mock settles after ~2s, or lazily on the next wallet read).
 */
export async function POST(request: Request) {
  try {
    const { user, student } = await getStudentContext();
    if (!user.universityId) {
      throw badRequest('Your account is not linked to a university.');
    }

    const limit = rateLimit(`student:topup:${user.id}`, 5, 60_000);
    if (!limit.allowed) {
      throw tooManyRequests(
        'Too many top-up attempts. Please wait a minute and try again.',
        limit.retryAfterSeconds,
      );
    }

    const body = await parseJson(request, topUpSchema);
    const phone = body.phone ?? user.phone;

    if (getAzamPayConfig()) {
      const result = await initiateAzamPayTopUp({
        universityId: user.universityId,
        studentProfileId: student.id,
        amount: body.amount,
        phone,
        network: body.network,
      });
      const azamData: TopUpCreated = {
        transactionId: result.transactionId,
        reference: result.reference,
        status: 'PENDING',
        routeCode: result.routeCode,
        message: result.message,
        aggregatorFee: result.aggregatorFee,
        provider: 'azampay',
      };
      return ok(azamData);
    }

    if (getWhopConfig()) {
      const university = await prisma.university.findUnique({
        where: { id: user.universityId },
        select: { paymentRouteCode: true, status: true },
      });
      if (!university || university.status !== 'ACTIVE') {
        throw badRequest('This university is not accepting top-ups right now.');
      }

      const reference = randomReference('TOP');
      const transaction = await prisma.transaction.create({
        data: {
          reference,
          universityId: user.universityId,
          studentId: student.id,
          amount: body.amount,
          fee: 0,
          aggregatorFee: 0,
          type: 'TOPUP',
          status: 'PENDING',
          phone,
          network: 'WHOP',
          routeCode: university.paymentRouteCode,
          metadata: JSON.stringify({
            provider: 'whop',
            channel: 'WHOP_CHECKOUT',
            universityCode: user.university?.code,
            routeCode: university.paymentRouteCode,
            lipaNamba: university.paymentRouteCode,
          }),
        },
      });

      try {
        // Whop rejects a non-HTTPS redirect URL. Prefer the public tunnel origin
        // when the request itself came from localhost during desktop testing.
        const requestOrigin = externalUrl(request, '/').origin;
        const publicOrigin = requestOrigin.startsWith('https://')
          ? requestOrigin
          : env.GOOGLE_MOBILE_REDIRECT_URI
            ? new URL(env.GOOGLE_MOBILE_REDIRECT_URI).origin
            : requestOrigin.startsWith('https://')
              ? requestOrigin
              : null;
        if (!publicOrigin) {
          throw badRequest('Whop requires a public HTTPS return URL. Open Kupon through the HTTPS tunnel.');
        }

        const returnUrl = new URL('/student/topup', publicOrigin);
        returnUrl.searchParams.set('whop', 'return');
        returnUrl.searchParams.set('tx', transaction.id);
        returnUrl.searchParams.set('ref', reference);
        returnUrl.searchParams.set('amount', String(body.amount));

        const checkout = await createWhopCheckout({
          amount: body.amount,
          reference,
          studentId: student.id,
          universityId: user.universityId,
          redirectUrl: returnUrl.toString(),
        });

        await prisma.transaction.update({
          where: { id: transaction.id },
          data: {
            metadata: JSON.stringify({
              provider: 'whop',
              channel: 'WHOP_CHECKOUT',
              universityCode: user.university?.code,
              routeCode: university.paymentRouteCode,
              lipaNamba: university.paymentRouteCode,
              whopCheckoutId: checkout.checkoutId,
              whopVariantId: checkout.variantId,
              checkoutUrl: checkout.checkoutUrl,
            }),
          },
        });

        const whopData: TopUpCreated = {
          transactionId: transaction.id,
          reference,
          status: 'PENDING',
          routeCode: university.paymentRouteCode,
          message: 'Complete the card payment on Whop. Your wallet is credited when Whop confirms.',
          aggregatorFee: 0,
          checkoutUrl: checkout.checkoutUrl,
          provider: 'whop',
        };
        return ok(whopData);
      } catch (error) {
        await prisma.transaction.updateMany({
          where: { id: transaction.id, status: 'PENDING' },
          data: {
            status: 'FAILED',
            failureReason: error instanceof Error ? error.message : 'Whop checkout failed',
          },
        });
        throw error;
      }
    }

    const result = await getPaymentProvider().initiateTopUp({
      universityId: user.universityId,
      studentProfileId: student.id,
      amount: body.amount,
      phone,
      network: body.network,
    });

    const data: TopUpCreated = {
      transactionId: result.transactionId,
      reference: result.reference,
      status: 'PENDING',
      routeCode: result.routeCode,
      message: result.message,
      aggregatorFee: result.aggregatorFee,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}

/**
 * GET /api/student/topup?id=
 *
 * Polled by the top-up screen. Lazily settles stale mock top-ups so the UI
 * reaches the success state even if the in-process timer was frozen.
 */
export async function GET(request: Request) {
  try {
    const { student } = await getStudentContext();
    const params = searchParams(request);
    const { id } = idSchema.parse({ id: params.get('id') ?? '' });

    await snippeMock.settleStaleTopUps(student.id);

    const [transaction, balance] = await Promise.all([
      prisma.transaction.findFirst({
        where: { id, studentId: student.id, type: 'TOPUP' },
      }),
      getStudentBalance(student.id),
    ]);

    if (!transaction) throw notFound('This top-up was not found.');

    const data: TopUpStatusData = {
      transaction: {
        id: transaction.id,
        reference: transaction.reference,
        amount: transaction.amount,
        status: transaction.status as TopUpStatusData['transaction']['status'],
        network: transaction.network,
        createdAt: transaction.createdAt.toISOString(),
        settledAt: transaction.settledAt?.toISOString() ?? null,
      },
      balance,
    };

    return ok(data);
  } catch (error) {
    return fail(error);
  }
}
