import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { unauthorized, tooManyRequests } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { vendorPasswordLoginSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!(await rateLimit(`vendor-password-login:ip:${ip}`, 20, 10 * 60_000)).allowed) {
      throw tooManyRequests('Too many login attempts from this network.');
    }

    const body = await parseJson(request, vendorPasswordLoginSchema);
    if (!(await rateLimit(`vendor-password-login:${body.identifier}`, 8, 10 * 60_000)).allowed) {
      throw tooManyRequests('This account is temporarily locked. Try again later.');
    }

    const user = await prisma.user.findFirst({
      where: {
        role: 'VENDOR',
        OR: [{ email: body.identifier }, { phone: body.identifier }],
      },
      include: {
        university: { select: { id: true, name: true, code: true, status: true } },
        vendor: { select: { id: true, name: true, code: true, status: true } },
        vendorApplication: { select: { phone: true } },
      },
    });
    const hash =
      user?.passwordHash ?? '$2a$10$jvPplD9ywuj93bbTBoZL7Ovo1NdNQ.Zhm60O8kFZ64m9i4z4aCPFG';
    const validPassword = await bcrypt.compare(body.password, hash);
    if (!user || user.role !== 'VENDOR' || !user.vendor || !validPassword) {
      throw unauthorized('Phone number or password is incorrect.');
    }
    if (user.vendor.status === 'SUSPENDED' || user.university?.status !== 'ACTIVE') {
      throw unauthorized('This cafeteria account is not active on Kupon.');
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    const token = await signSession({
      uid: user.id,
      role: 'VENDOR',
      universityId: user.universityId,
      name: user.name,
      phone: user.phone ?? user.vendorApplication?.phone ?? '',
    });
    const response = ok({
      user: {
        id: user.id,
        name: user.name,
        role: 'VENDOR' as const,
        vendorName: user.vendor.name,
        vendorCode: user.vendor.code,
        university: user.university,
      },
      redirectTo: roleHome('VENDOR'),
    });
    return setSessionCookie(response, token);
  } catch (error) {
    return fail(error);
  }
}
