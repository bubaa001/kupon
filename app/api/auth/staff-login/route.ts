import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { tooManyRequests, unauthorized } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { staffLoginSchema } from '@/lib/validators';
import type { Role } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`staff-login:ip:${ip}`, 20, 10 * 60 * 1000);
    if (!ipLimit.allowed) throw tooManyRequests('Too many login attempts from this network.');

    const body = await parseJson(request, staffLoginSchema);
    const phoneLimit = rateLimit(`staff-login:${body.phone}`, 8, 10 * 60 * 1000);
    if (!phoneLimit.allowed) {
      throw tooManyRequests('This account is temporarily locked. Try again later.');
    }

    const user = await prisma.user.findUnique({
      where: { phone: body.phone },
      include: {
        university: { select: { id: true, name: true, code: true, status: true } },
      },
    });

    const hash = user?.passwordHash ?? '$2a$10$jvPplD9ywuj93bbTBoZL7Ovo1NdNQ.Zhm60O8kFZ64m9i4z4aCPFG';
    const validPassword = await bcrypt.compare(body.password, hash);
    if (!user || !validPassword || !['ADMIN', 'SUPER_ADMIN', 'FINANCE'].includes(user.role)) {
      throw unauthorized('Phone number or password is incorrect.');
    }
    if (user.role === 'ADMIN' && user.university?.status !== 'ACTIVE') {
      throw unauthorized('This university is suspended on Kupon.');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    const token = await signSession({
      uid: user.id,
      role: user.role as Role,
      universityId: user.universityId,
      name: user.name,
      phone: user.phone,
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
