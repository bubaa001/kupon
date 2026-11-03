import { z, ZodError } from 'zod';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { AppError, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { USSD_ENABLED } from '@/lib/features';
import { MAX_TOPUP, MIN_TOPUP, MOBILE_NETWORKS, NETWORK_LABEL } from '@/lib/constants';
import { paymentSms } from '@/lib/sms';
import { getPaymentProvider } from '@/lib/payments';
import { chargeViaUssd } from '@/lib/payments/charge';
import { phoneSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * USSD SIMULATION, NOT A PRODUCTION GATEWAY
 * ─────────────────────────────────────────────────────────────────────────────
 * A real USSD flow is driven by the telco (Vodacom, Tigo, Airtel, Halotel) over a
 * session where the MSISDN is asserted by the network, never by the handset.
 * This route exists so the browser can rehearse the *same* server logic:
 *
 *   telco gateway  ->  trusted MSISDN session  ->  chargeViaUssd()
 *   this route     ->  `phone` in the POST body -> chargeViaUssd()
 *
 * When a gateway is added, keep `chargeViaUssd()` and the service calls below,
 * delete this public endpoint, and mount the handler behind the aggregator's
 * signed webhook/session instead. The browser must never be trusted to assert a
 * phone number, PIN or balance in production.
 *
 * The `sms` array in every response is the script of the confirmation text a
 * subscriber would receive on the handset. The feature-phone UI renders it as
 * the device SMS log.
 */

const NETWORK_IDS = MOBILE_NETWORKS.map((network) => network.id) as [string, ...string[]];

const baseSchema = z.object({
  phone: phoneSchema,
  universityId: z.string().min(1).optional(),
});

const ussdRequestSchema = z.discriminatedUnion('action', [
  baseSchema.extend({ action: z.literal('balance') }),
  baseSchema.extend({
    action: z.literal('pay'),
    // The handset keypad can only send digits, so both `V-UDSM-001` and the
    // short till number `001` are accepted. A short number is resolved inside
    // the student's own university, which keeps tenant isolation intact.
    vendorCode: z
      .string()
      .trim()
      .min(1, 'Enter the vendor number')
      .max(30)
      .transform((value) => value.toUpperCase()),
    amount: z.number().int().min(500, 'Minimum payment is TZS 500').max(100_000),
    pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits'),
  }),
  baseSchema.extend({
    action: z.literal('topup'),
    amount: z
      .number()
      .int()
      .min(MIN_TOPUP, `Minimum top up is TZS ${MIN_TOPUP}`)
      .max(MAX_TOPUP, `Maximum top up is TZS ${MAX_TOPUP}`),
    network: z.enum(NETWORK_IDS).default('M-PESA'),
  }),
]);

function toSmsLine(message: string): string {
  const clean = message.replace(/\s+/g, ' ').trim();
  return clean.length > 160 ? `${clean.slice(0, 157)}...` : clean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Attaches the handset SMS log to an error envelope. The terminal still renders
 * a real failure screen, but reviewers see the failure text a subscriber would
 * receive, which is how a telco session behaves in practice.
 */
function withSms(error: unknown, sms: string[]): unknown {
  if (!(error instanceof AppError)) return error;
  return new AppError(error.message, error.statusCode, error.code, {
    ...(isRecord(error.details) ? error.details : {}),
    sms,
  });
}

function failureSms(message: string): string[] {
  return [toSmsLine(`KUPON: Ombi halijakamilika. ${message}`)];
}

/**
 * Resolves a human/feature-phone vendor reference to the canonical
 * `V-UDSM-001` code. Full codes pass through untouched; a 1 to 3 digit till
 * number is matched only inside the student's university.
 */
async function resolveVendorCode(input: {
  vendorCode: string;
  phone: string;
  universityId?: string;
}): Promise<string> {
  if (/^V-[A-Z]{2,8}-\d{3}$/.test(input.vendorCode)) {
    return input.vendorCode;
  }

  if (!/^\d{1,3}$/.test(input.vendorCode)) {
    throw new AppError(
      'Enter the 3-digit vendor number shown at the counter, for example 001.',
      422,
      'INVALID_VENDOR_CODE',
    );
  }

  const student = await prisma.studentProfile.findFirst({
    where: {
      user: { phone: input.phone, role: 'STUDENT' },
      ...(input.universityId ? { universityId: input.universityId } : {}),
    },
    select: { universityId: true, university: { select: { code: true } } },
  });
  if (!student) {
    throw notFound('No Kupon wallet is registered to this phone number.');
  }

  const till = input.vendorCode.padStart(3, '0');
  const vendor = await prisma.vendor.findFirst({
    where: {
      universityId: student.universityId,
      code: { endsWith: `-${till}` },
    },
    select: { code: true },
  });
  if (!vendor) {
    throw notFound(
      `Vendor ${till} was not found at ${student.university.code}. Check the tent number and try again.`,
    );
  }

  return vendor.code;
}

export async function POST(request: Request) {
  if (!USSD_ENABLED) {
    return fail(new AppError('USSD and offline payments are paused.', 404, 'USSD_DISABLED'));
  }

  try {
    const body = await parseJson(request, ussdRequestSchema);

    const ip = getClientIp(request);
    // The telco would enforce these limits on the short code. This mimics it.
    const ipLimit = rateLimit(`ussd:ip:${ip}`, 40, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      throw tooManyRequests('Too many USSD sessions from this connection. Try again shortly.');
    }
    const phoneLimit = rateLimit(`ussd:phone:${body.phone}`, 20, 10 * 60 * 1000);
    if (!phoneLimit.allowed) {
      throw tooManyRequests(
        `Too many USSD requests for this number. Try again in ${phoneLimit.retryAfterSeconds}s.`,
      );
    }
    if (body.action !== 'balance') {
      const actionLimit = rateLimit(`ussd:${body.action}:${body.phone}`, 8, 10 * 60 * 1000);
      if (!actionLimit.allowed) {
        throw tooManyRequests(
          `Too many ${body.action === 'pay' ? 'payment' : 'top up'} attempts. Try again in ${actionLimit.retryAfterSeconds}s.`,
        );
      }
    }

    if (body.action === 'balance') {
      const student = await prisma.studentProfile.findFirst({
        where: {
          user: { phone: body.phone, role: 'STUDENT' },
          ...(body.universityId ? { universityId: body.universityId } : {}),
        },
        include: {
          user: { select: { name: true, phone: true } },
          wallet: true,
          university: { select: { id: true, name: true, code: true, city: true, status: true } },
        },
      });
      if (!student) {
        throw notFound('No Kupon wallet is registered to this phone number.');
      }
      if (student.university.status !== 'ACTIVE') {
        throw new AppError(
          `${student.university.code} is suspended on Kupon. Contact your bursar.`,
          403,
          'UNIVERSITY_SUSPENDED',
        );
      }

      const balance = student.wallet?.balance ?? student.walletBalance;
      const sms = [
        toSmsLine(
          `KUPON: Salio lako ni TZS ${balance.toLocaleString('en-US')}. Akaunti ${student.studentId}.`,
        ),
      ];

      return ok({
        studentName: student.user.name,
        studentNumber: student.studentId,
        phone: student.user.phone,
        balance,
        currency: 'TZS',
        university: {
          id: student.university.id,
          name: student.university.name,
          code: student.university.code,
          city: student.university.city,
        },
        sms,
      });
    }

    if (body.action === 'pay') {
      const vendorCode = await resolveVendorCode({
        vendorCode: body.vendorCode,
        phone: body.phone,
        universityId: body.universityId,
      });

      const result = await chargeViaUssd({
        phone: body.phone,
        vendorCode,
        amount: body.amount,
        pin: body.pin,
        universityId: body.universityId,
      });

      const balance = result.balance ?? 0;
      const transaction = await prisma.transaction.findUnique({
        where: { id: result.transactionId },
        select: { reference: true },
      });
      const sms = [toSmsLine(paymentSms(result.amount, result.vendorName, balance))];

      return ok({
        studentName: result.studentName,
        vendorName: result.vendorName,
        vendorCode,
        amount: result.amount,
        balance,
        transactionId: result.transactionId,
        reference: transaction?.reference ?? `USSD-${result.transactionId.slice(-6).toUpperCase()}`,
        sms,
      });
    }

    // action === 'topup'
    const student = await prisma.studentProfile.findFirst({
      where: {
        user: { phone: body.phone, role: 'STUDENT' },
        ...(body.universityId ? { universityId: body.universityId } : {}),
      },
      include: {
        user: { select: { name: true, phone: true } },
        wallet: true,
        university: { select: { id: true, name: true, code: true, status: true } },
      },
    });
    if (!student) {
      throw notFound('No Kupon wallet is registered to this phone number.');
    }
    if (student.university.status !== 'ACTIVE') {
      throw new AppError(
        `${student.university.code} is suspended on Kupon. Top ups are disabled.`,
        403,
        'UNIVERSITY_SUSPENDED',
      );
    }

    const provider = getPaymentProvider();
    // `default('M-PESA')` is applied by Zod; the fallback keeps the inferred
    // input type safe as well (Zod schemas distinguish input from output types).
    const network = body.network ?? 'M-PESA';
    const topUp = await provider.initiateTopUp({
      universityId: student.universityId,
      studentProfileId: student.id,
      amount: body.amount,
      phone: student.user.phone,
      network,
    });

    const networkLabel = NETWORK_LABEL[network] ?? network;
    const sms = [
      toSmsLine(
        `KUPON: Ombi la kuweka TZS ${body.amount.toLocaleString('en-US')} kupitia ${networkLabel} limepokelewa. Ref ${topUp.reference}.`,
      ),
    ];

    return ok({
      studentName: student.user.name,
      studentNumber: student.studentId,
      amount: body.amount,
      network,
      networkLabel,
      reference: topUp.reference,
      status: topUp.status,
      message: topUp.message,
      routeCode: topUp.routeCode,
      aggregatorFee: topUp.aggregatorFee,
      balance: student.wallet?.balance ?? student.walletBalance,
      university: {
        id: student.university.id,
        name: student.university.name,
        code: student.university.code,
      },
      sms,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      const issue = error.issues[0];
      const message = issue?.message ?? 'Check the details and try again.';
      return fail(
        withSms(
          new AppError(message, 422, 'VALIDATION_ERROR', {
            issues: error.flatten().fieldErrors,
          }),
          failureSms(message),
        ),
      );
    }

    return fail(
      withSms(error, failureSms(error instanceof Error ? error.message : 'Something went wrong.')),
    );
  }
}
