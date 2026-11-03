import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { AppError, notFound, tooManyRequests } from '@/lib/errors';
import { rateLimit } from '@/lib/rate-limit';
import { otpRequestSchema } from '@/lib/validators';
import { sendSms } from '@/lib/sms';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OTP_TTL_SECONDS = 5 * 60;

/**
 * Requests a login OTP. Rate limited per IP and per phone number.
 * In DEMO_MODE the code is returned in the response so reviewers can log in
 * without an SMS gateway. Production only sends the SMS.
 */
export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`otp:ip:${ip}`, 20, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      throw tooManyRequests('Too many code requests from this network. Try again shortly.');
    }

    const body = await parseJson(request, otpRequestSchema);

    const phoneLimit = rateLimit(`otp:phone:${body.phone}`, 4, 10 * 60 * 1000);
    if (!phoneLimit.allowed) {
      throw tooManyRequests(
        `Too many codes requested for this number. Try again in ${phoneLimit.retryAfterSeconds}s.`,
      );
    }

    const university = await prisma.university.findUnique({
      where: { id: body.universityId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!university) throw notFound('That university was not found.');
    if (university.status !== 'ACTIVE') {
      throw new AppError('This university is not active on Kupon yet.', 403, 'UNIVERSITY_INACTIVE');
    }

    const student = await prisma.user.findFirst({
      where: {
        phone: body.phone,
        role: 'STUDENT',
        universityId: university.id,
      },
      select: { id: true, name: true },
    });

    if (!student) {
      if (!env.DEMO_MODE) {
        // Deliberately generic in production to prevent phone-number enumeration.
        return ok({
          phone: body.phone,
          universityId: university.id,
          expiresIn: OTP_TTL_SECONDS,
          message: 'If this number is registered, a code has been sent by SMS.',
        });
      }
      throw notFound(
        `No Kupon student found for ${body.phone} at ${university.code}. Use one of the demo numbers below.`,
      );
    }

    const code = randomInt(100000, 999999).toString();

    // Invalidate any previous unused codes for this phone.
    await prisma.otpCode.updateMany({
      where: { phone: body.phone, consumed: false },
      data: { consumed: true },
    });

    await prisma.otpCode.create({
      data: {
        phone: body.phone,
        code,
        universityId: university.id,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });

    await sendSms(
      body.phone,
      `KUPON: Namba yako ya kuingia ni ${code}. Inaisha baada ya dakika 5. Usimpe mtu yeyote.`,
    );

    return ok({
      phone: body.phone,
      universityId: university.id,
      expiresIn: OTP_TTL_SECONDS,
      demoOtp: env.DEMO_MODE ? code : undefined,
      message: `Code sent to ${body.phone}. It expires in 5 minutes.`,
    });
  } catch (error) {
    return fail(error);
  }
}
