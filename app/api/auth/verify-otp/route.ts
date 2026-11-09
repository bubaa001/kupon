import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { AppError, tooManyRequests, unauthorized } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { otpVerifySchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const hashOtp = (phone: string, code: string) =>
  createHmac('sha256', env.JWT_SECRET).update(`${phone}:${code}`).digest();

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && env.SMS_PROVIDER === 'mock') {
      throw new AppError('Student code login is unavailable until SMS delivery is configured.', 503, 'SMS_UNAVAILABLE');
    }
    const ip = getClientIp(request);
    const ipLimit = await rateLimit(`otp-verify:ip:${ip}`, 40, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      throw tooManyRequests('Too many verification attempts from this network.');
    }

    const body = await parseJson(request, otpVerifySchema);
    const phoneLimit = await rateLimit(`otp-verify:${body.phone}`, 10, 10 * 60 * 1000);
    if (!phoneLimit.allowed) {
      throw tooManyRequests('Too many attempts. Request a new code in a few minutes.');
    }

    const otp = await prisma.otpCode.findFirst({
      where: {
        phone: body.phone,
        universityId: body.universityId,
        consumed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) {
      throw new AppError(
        'No active code found. Request a new OTP.',
        410,
        'OTP_EXPIRED',
      );
    }
    if (otp.expiresAt.getTime() <= Date.now()) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
      throw new AppError('This code has expired. Request a new one.', 410, 'OTP_EXPIRED');
    }
    if (otp.attempts >= 5) {
      await prisma.otpCode.update({ where: { id: otp.id }, data: { consumed: true } });
      throw tooManyRequests('Too many incorrect attempts. Request a new code.', 60);
    }

    const storedHash = Buffer.from(otp.code, 'hex');
    const suppliedHash = hashOtp(body.phone, body.code);
    const matches = storedHash.length === suppliedHash.length && timingSafeEqual(storedHash, suppliedHash);
    if (!matches) {
      const attempt = await prisma.otpCode.updateMany({
        where: { id: otp.id, consumed: false, attempts: { lt: 5 } },
        data: { attempts: { increment: 1 } },
      });
      if (attempt.count === 0) {
        await prisma.otpCode.updateMany({
          where: { id: otp.id, consumed: false },
          data: { consumed: true },
        });
        throw tooManyRequests('Too many incorrect attempts. Request a new code.', 60);
      }
      throw new AppError(
        `Incorrect code. ${Math.max(0, 4 - otp.attempts)} attempts left.`,
        401,
        'INVALID_OTP',
      );
    }

    const claimed = await prisma.otpCode.updateMany({
      where: { id: otp.id, consumed: false },
      data: { consumed: true },
    });
    if (claimed.count === 0) {
      throw new AppError('This code was already used. Request a new one.', 409, 'OTP_USED');
    }

    const user = await prisma.user.findFirst({
      where: {
        phone: body.phone,
        role: 'STUDENT',
        universityId: body.universityId,
      },
      include: {
        university: { select: { name: true, code: true } },
        student: { select: { studentId: true } },
      },
    });
    if (!user) {
      throw unauthorized('No student account matches this number and university.');
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), otp: null, otpExpiresAt: null },
    });

    const token = await signSession({
      uid: user.id,
      role: 'STUDENT',
      universityId: user.universityId,
      name: user.name,
      phone: user.phone ?? '',
    });

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone ?? '',
        role: 'STUDENT' as const,
        studentId: user.student?.studentId,
        university: user.university,
      },
      redirectTo: roleHome('STUDENT'),
    });
    return setSessionCookie(response, token);
  } catch (error) {
    return fail(error);
  }
}
