import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser } from '@/lib/auth';
import { conflict, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createFinanceUserSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
});

export async function POST(request: Request) {
  try {
    const actor = await requireApiUser(['SUPER_ADMIN']);
    const limit = rateLimit(`super-admin:create-finance:${actor.id}`, 5, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many finance accounts created. Try again later.');
    const body = await parseJson(request, createFinanceUserSchema);
    if (await prisma.user.findUnique({ where: { phone: body.phone }, select: { id: true } })) {
      throw conflict('That phone number is already linked to a Kupon account.');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name,
          phone: body.phone,
          role: 'FINANCE',
          passwordHash,
        },
        select: { id: true, name: true, phone: true, role: true },
      });
      await auditLog(
        {
          actorId: actor.id,
          action: 'FINANCE_USER_CREATED',
          entity: 'User',
          entityId: created.id,
          metadata: { role: created.role },
        },
        tx,
      );
      return created;
    });

    return ok({ user }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
