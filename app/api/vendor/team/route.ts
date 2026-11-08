import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { conflict, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { phoneSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limit';
import { requireVendorAccess } from '../_lib/access';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createTeamAccountSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: z
    .string()
    .min(12)
    .max(128)
    .regex(/[a-z]/)
    .regex(/[A-Z]/)
    .regex(/\d/),
  role: z.enum(['STAFF', 'FINANCE']),
});

export async function GET() {
  try {
    const { vendor } = await requireVendorAccess();
    const accounts = await prisma.user.findMany({
      where: { managedVendorId: vendor.id, role: { in: ['STAFF', 'FINANCE'] } },
      select: { id: true, name: true, phone: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return ok({ accounts });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(request: Request) {
  try {
    const { user: actor, vendor, universityId } = await requireVendorAccess();
    const limit = rateLimit(`vendor:create-team-account:${vendor.id}`, 10, 60 * 60_000);
    if (!limit.allowed) throw tooManyRequests('Too many team accounts created. Try again later.');

    const body = await parseJson(request, createTeamAccountSchema);
    if (await prisma.user.findUnique({ where: { phone: body.phone }, select: { id: true } })) {
      throw conflict('That phone number is already linked to a Kupon account.');
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const account = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name: body.name,
          phone: body.phone,
          role: body.role,
          passwordHash,
          universityId,
          managedVendorId: vendor.id,
        },
        select: { id: true, name: true, phone: true, role: true, createdAt: true },
      });

      await auditLog(
        {
          actorId: actor.id,
          universityId,
          action: 'VENDOR_TEAM_ACCOUNT_CREATED',
          entity: 'User',
          entityId: created.id,
          metadata: { role: created.role, vendorId: vendor.id },
        },
        tx,
      );
      return created;
    });

    return ok({ account }, { status: 201 });
  } catch (error) {
    return fail(error);
  }
}
