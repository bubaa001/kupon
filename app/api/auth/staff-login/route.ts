import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { tooManyRequests, unauthorized } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { phoneSchema, staffLoginSchema } from '@/lib/validators';
import { normalizePhone } from '@/lib/utils';
import type { Role } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`staff-login:ip:${ip}`, 20, 10 * 60 * 1000);
    if (!ipLimit.allowed) throw tooManyRequests('Too many login attempts from this network.');

    const body = await parseJson(request, staffLoginSchema);
    const rawIdentifier = body.identifier ?? body.phone ?? '';
    const parsedPhone = phoneSchema.safeParse(rawIdentifier);
    const identifier = parsedPhone.success
      ? normalizePhone(rawIdentifier)
      : rawIdentifier.toLowerCase();
    const phoneLimit = rateLimit(`staff-login:${identifier}`, 8, 10 * 60 * 1000);
    if (!phoneLimit.allowed) {
      throw tooManyRequests('This account is temporarily locked. Try again later.');
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { phone: identifier }],
      },
      include: {
        university: { select: { id: true, name: true, code: true, status: true } },
        managedVendor: { select: { id: true, status: true, universityId: true } },
      },
    });

    const hash = user?.passwordHash ?? '$2a$10$jvPplD9ywuj93bbTBoZL7Ovo1NdNQ.Zhm60O8kFZ64m9i4z4aCPFG';
    const validPassword = await bcrypt.compare(body.password, hash);
    if (!user || !validPassword || !['ADMIN', 'SUPER_ADMIN', 'FINANCE', 'STAFF'].includes(user.role)) {
      throw unauthorized('Username or phone number and password are incorrect.');
    }
    if (user.role === 'ADMIN' && user.university?.status !== 'ACTIVE') {
      throw unauthorized('This university is suspended on Kupon.');
    }
    if (user.role === 'STAFF' && user.managedVendorId === null) {
      throw unauthorized('This staff account is not linked to a cafeteria.');
    }
    if (
      user.managedVendor &&
      (user.managedVendor.status !== 'ACTIVE' ||
        user.managedVendor.universityId !== user.universityId ||
        user.university?.status !== 'ACTIVE')
    ) {
      throw unauthorized('This cafeteria account is not active on Kupon.');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = await signSession({
      uid: user.id,
      role: user.role as Role,
      universityId: user.universityId,
      name: user.name,
      phone: user.phone ?? '',
    });

    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        university: user.university,
      },
      redirectTo: roleHome(user.role as Role),
    });
    return setSessionCookie(response, token);
  } catch (error) {
    return fail(error);
  }
}
