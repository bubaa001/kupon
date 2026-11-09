import { timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { conflict, forbidden, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { roleHome, signSession, setSessionCookie } from '@/lib/auth';
import { phoneSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const setupSchema = z.object({
  setupToken: z.string().min(32).max(512),
  username: z.string().trim().min(3).max(32).regex(/^[a-zA-Z0-9._-]+$/).transform((value) => value.toLowerCase()),
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()).optional().or(z.literal('')),
  phone: phoneSchema.optional().or(z.literal('')),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = await rateLimit(`bootstrap-super-admin:${ip}`, 5, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many setup attempts. Try again later.');
    if (!env.SUPER_ADMIN_SETUP_TOKEN) {
      throw forbidden('First-owner setup is disabled until its server token is configured.');
    }

    const body = await parseJson(request, setupSchema);
    const supplied = Buffer.from(body.setupToken);
    const expected = Buffer.from(env.SUPER_ADMIN_SETUP_TOKEN);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      throw forbidden('The setup token is incorrect.');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(
      async (tx) => {
        if ((await tx.user.count({ where: { role: 'SUPER_ADMIN' } })) !== 0) {
          throw conflict('First-owner setup is already closed.');
        }
        return tx.user.create({
          data: {
            name: body.name || 'Kupon Platform Admin',
            email: body.email || null,
            phone: body.phone || null,
            username: body.username,
            passwordHash,
            role: 'SUPER_ADMIN',
          },
          select: { id: true, name: true, phone: true, role: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const token = await signSession({
      uid: user.id,
      role: 'SUPER_ADMIN',
      universityId: null,
      name: user.name,
      phone: user.phone ?? '',
    });
    const response = ok({ user, redirectTo: roleHome('SUPER_ADMIN') }, { status: 201 });
    return setSessionCookie(response, token);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(conflict('That username, email or phone number already belongs to an account.'));
    }
    return fail(error);
  }
}
