import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { conflict, forbidden, notFound, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { roleHome, setSessionCookie, signSession } from '@/lib/auth';
import {
  GOOGLE_VENDOR_ACTIVATION_COOKIE,
  verifyGoogleVendorActivationTicket,
} from '@/lib/google-signup';
import type { Role } from '@/lib/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const activationSchema = z.object({
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(`vendor-activate:${ip}`, 5, 10 * 60_000).allowed) {
      throw tooManyRequests('Too many setup attempts. Try again later.');
    }

    const ticket = await verifyGoogleVendorActivationTicket(
      request.cookies.get(GOOGLE_VENDOR_ACTIVATION_COOKIE)?.value,
    );
    if (!ticket) throw forbidden('Your Google verification expired. Continue with Google again.');

    const body = await parseJson(request, activationSchema);
    const application = await prisma.vendorApplication.findFirst({
      where: {
        id: ticket.applicationId,
        email: ticket.email,
        status: 'APPROVED',
        userId: null,
      },
      include: { university: { select: { id: true, code: true, status: true } } },
    });
    if (!application) throw notFound('No approved application is available for this Google account.');
    const university = application.university;
    if (!university || university.status !== 'ACTIVE') {
      throw forbidden('This campus is not active. Contact the platform administrator.');
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email: ticket.email },
      select: { id: true },
    });
    if (emailOwner) {
      throw conflict(
        'This Google email is already linked to a Kupon account. Contact the Platform Admin to resolve the conflict with your approved vendor application.',
      );
    }
    const phoneOwner = await prisma.user.findUnique({
      where: { phone: application.phone },
      select: { id: true },
    });
    if (phoneOwner) {
      throw conflict(
        'The phone number on your application is already linked to a Kupon account. If it is yours, contact the Platform Admin to resolve the conflict; otherwise ask them to correct the application phone number.',
      );
    }

    const passwordHash = await bcrypt.hash(body.password, 12);
    const pinHash = await bcrypt.hash(randomBytes(24).toString('hex'), 10);
    const prefix = `V-${university.code}-`;
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.vendorApplication.updateMany({
        where: { id: application.id, status: 'APPROVED', userId: null },
        data: { status: 'COMPLETED' },
      });
      if (claimed.count !== 1) {
        throw conflict('This approved application has already been activated.');
      }

      const lastVendor = await tx.vendor.findFirst({
        where: { code: { startsWith: prefix } },
        orderBy: { code: 'desc' },
        select: { code: true },
      });
      const lastNumber = lastVendor
        ? Number.parseInt(lastVendor.code.slice(prefix.length), 10)
        : 0;
      let sequence = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
      let vendorCode = `${prefix}${String(sequence).padStart(3, '0')}`;
      while (await tx.vendor.findUnique({ where: { code: vendorCode }, select: { id: true } })) {
        sequence += 1;
        vendorCode = `${prefix}${String(sequence).padStart(3, '0')}`;
      }

      const user = await tx.user.create({
        data: {
          name: application.ownerName,
          email: ticket.email,
          googleId: ticket.sub,
          phone: application.phone,
          passwordHash,
          role: 'VENDOR',
          universityId: university.id,
          lastLoginAt: new Date(),
        },
        select: { id: true, name: true, phone: true, role: true, universityId: true },
      });
      const vendor = await tx.vendor.create({
        data: {
          userId: user.id,
          universityId: university.id,
          name: application.businessName,
          code: vendorCode,
          pin: pinHash,
          description: `Cafeteria at ${application.universityName}`,
          applicationReviewNote: application.reviewNote,
          applicationReviewedAt: application.reviewedAt,
          physicalSiteVerified: true,
          settlementAccount: 'Pending payout details',
          status: 'ACTIVE',
        },
        select: { id: true, name: true, code: true },
      });
      await tx.vendorApplication.update({
        where: { id: application.id },
        data: { userId: user.id },
      });
      await auditLog(
        {
          actorId: user.id,
          universityId: university.id,
          action: 'VENDOR_ACCOUNT_ACTIVATED',
          entity: 'Vendor',
          entityId: vendor.id,
          metadata: { applicationId: application.id, code: vendor.code },
        },
        tx,
      );
      return { user, vendor };
    });

    const role = created.user.role as Role;
    const token = await signSession({
      uid: created.user.id,
      role,
      universityId: created.user.universityId,
      name: created.user.name,
      phone: created.user.phone ?? '',
    });
    const response = ok({
      vendor: created.vendor,
      redirectTo: roleHome(role),
    }, { status: 201 });
    setSessionCookie(response, token);
    response.cookies.set({
      name: GOOGLE_VENDOR_ACTIVATION_COOKIE,
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
        conflict(
          'The Google email or application phone number was linked to a Kupon account during setup. Contact the Platform Admin to resolve this account conflict.',
        ),
      );
    }
    return fail(error);
  }
}
