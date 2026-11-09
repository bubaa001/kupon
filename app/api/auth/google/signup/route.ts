import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson, getClientIp } from '@/lib/api';
import { conflict, forbidden, tooManyRequests } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { signSession, setSessionCookie } from '@/lib/auth';
import { env } from '@/lib/env';
import {
  GOOGLE_SIGNUP_COOKIE,
  verifyGoogleSignupTicket,
} from '@/lib/google-signup';
import { phoneSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(80),
  phone: phoneSchema,
  studentId: z
    .string()
    .trim()
    .min(3, 'Enter your student number')
    .max(40)
    .transform((value) => value.toUpperCase()),
  course: z.string().trim().max(80).optional().or(z.literal('')),
  year: z.coerce.number().int().min(1).max(8),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that these details are yours.' }),
  }),
});

/**
 * POST /api/auth/google/signup
 *
 * Completes a Google-first student signup. The browser can only reach this
 * route with a valid signed ticket issued by the Google callback, so the email
 * and Google subject are always Google-verified. A wallet is created with a
 * zero balance; no seeded funds are attached.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = await rateLimit(`google-signup:${getClientIp(request)}`, 8, 10 * 60 * 1000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many signup attempts. Try again in a few minutes.');
    }

    const ticket = await verifyGoogleSignupTicket(
      request.cookies.get(GOOGLE_SIGNUP_COOKIE)?.value,
    );
    if (!ticket) {
      throw forbidden('Your Google signup session expired. Start again from the login page.');
    }
    if (process.env.NODE_ENV === 'production' && !env.STUDENT_SIGNUP_ENABLED) {
      throw forbidden('New student enrollment is temporarily closed. Ask your university administrator to verify your account.');
    }

    const body = await parseJson(request, signupSchema);

    const university = await prisma.university.findUnique({
      where: { id: ticket.universityId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!university || university.status !== 'ACTIVE') {
      throw forbidden('This university is not accepting new wallets right now.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: ticket.email }, { googleId: ticket.sub }] },
      select: { id: true },
    });
    if (existingUser) {
      throw conflict('This Google account already has a Kupon wallet. Sign in with Google instead.');
    }

    const phoneOwner = await prisma.user.findUnique({
      where: { phone: body.phone },
      select: { id: true },
    });
    if (phoneOwner) {
      throw conflict(
        'This phone number is already linked to a Kupon account. Sign in or ask your admin to link this Google email.',
      );
    }

    const studentIdOwner = await prisma.studentProfile.findFirst({
      where: { universityId: university.id, studentId: body.studentId },
      select: { id: true },
    });
    if (studentIdOwner) {
      throw conflict(
        'That student number is already registered at this university. Check it or ask your admin.',
      );
    }

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: body.phone,
          email: ticket.email,
          googleId: ticket.sub,
          name: body.name,
          role: 'STUDENT',
          universityId: university.id,
          lastLoginAt: new Date(),
        },
      });

      const student = await tx.studentProfile.create({
        data: {
          userId: user.id,
          universityId: university.id,
          studentId: body.studentId,
          course: body.course?.trim() || 'General Studies',
          year: body.year,
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: university.id,
          action: 'STUDENT_GOOGLE_SIGNUP',
          entity: 'StudentProfile',
          entityId: student.id,
          metadata: {
            email: ticket.email,
            studentId: body.studentId,
            university: university.code,
            channel: 'google',
          },
        },
        tx,
      );

      return { user, student };
    });

    const token = await signSession({
      uid: created.user.id,
      role: 'STUDENT',
      universityId: university.id,
      name: created.user.name,
      phone: created.user.phone ?? '',
    });

    const response = ok({
      user: { id: created.user.id, name: created.user.name },
      redirectTo: '/student',
    });
    setSessionCookie(response, token);
    response.cookies.set({
      name: GOOGLE_SIGNUP_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(
        conflict('One of these details is already registered. Check your phone and student number.'),
      );
    }
    return fail(error);
  }
}
