import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { tooManyRequests, unauthorized } from '@/lib/errors';
import { signSession, setSessionCookie, roleHome } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';
import { vendorLoginSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const ipLimit = rateLimit(`vendor-login:ip:${ip}`, 25, 10 * 60 * 1000);
    if (!ipLimit.allowed) throw tooManyRequests('Too many login attempts from this network.');

    const body = await parseJson(request, vendorLoginSchema);
    const codeLimit = rateLimit(`vendor-login:${body.code}`, 8, 10 * 60 * 1000);
    if (!codeLimit.allowed) {
      throw tooManyRequests('This vendor account is temporarily locked. Try again later.');
    }

    const vendor = await prisma.vendor.findUnique({
      where: { code: body.code },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            vendorApplication: { select: { phone: true } },
          },
        },
        university: { select: { id: true, name: true, code: true, status: true } },
      },
    });

    // Compare even when the vendor does not exist to reduce timing differences.
    const hash = vendor?.pin ?? '$2a$10$jvPplD9ywuj93bbTBoZL7Ovo1NdNQ.Zhm60O8kFZ64m9i4z4aCPFG';
    const validPin = await bcrypt.compare(body.pin, hash);
    if (!vendor || !validPin) {
      throw unauthorized('Vendor code or PIN is incorrect.');
    }
    if (vendor.status !== 'ACTIVE') {
      throw unauthorized('This vendor terminal is suspended. Contact the university admin.');
    }
    if (vendor.university.status !== 'ACTIVE') {
      throw unauthorized('This university is suspended on Kupon.');
    }

    await prisma.user.update({
      where: { id: vendor.userId },
      data: { lastLoginAt: new Date() },
    });

    const token = await signSession({
      uid: vendor.user.id,
      role: 'VENDOR',
      universityId: vendor.universityId,
      name: vendor.user.name,
      phone: vendor.user.phone ?? vendor.user.vendorApplication?.phone ?? '',
    });

    const response = ok({
      user: {
        id: vendor.user.id,
        name: vendor.user.name,
        role: 'VENDOR' as const,
        vendorName: vendor.name,
        vendorCode: vendor.code,
        university: vendor.university,
      },
      redirectTo: roleHome('VENDOR'),
    });
    return setSessionCookie(response, token);
  } catch (error) {
    return fail(error);
  }
}
