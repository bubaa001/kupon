import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { AppError, tooManyRequests, unauthorized } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { otpVerifySchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`otp-verify:ip:${ip}`, 40, 10 * 60 * 1000);
    if (!ipLimit.allowed) {
      throw tooManyRequests('Too many verification attempts from this network.');
    }

    const body = await parseJson(request, otpVerifySchema);
    const phoneLimit = rateLimit(`otp-verify:${body.phone}`, 10, 10 * 60 * 1000);
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

    if (otp.code !== body.code) {
      await prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
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
      phone: user.phone,
    });

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
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
