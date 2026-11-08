import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { fail, ok, parseJson, getClientIp } from '@/lib/api';
import { conflict, forbidden, tooManyRequests } from '@/lib/errors';
import { auditLog } from '@/lib/audit';
import { rateLimit } from '@/lib/rate-limit';
import { signSession, setSessionCookie } from '@/lib/auth';
import { GOOGLE_VENDOR_COOKIE, verifyGoogleVendorTicket } from '@/lib/google-signup';
import { phoneSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const applicationSchema = z.object({
  ownerName: z.string().trim().min(2, 'Enter the owner name').max(80),
  businessName: z.string().trim().min(2, 'Enter the business name').max(80),
  phone: phoneSchema,
  description: z.string().trim().min(10, 'Describe what you sell').max(500),
  businessRegistrationNumber: z.string().trim().min(3).max(80),
  physicalAddress: z.string().trim().min(8).max(250),
  registrationDocumentUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.startsWith('https://'), 'Use a secure HTTPS document link.'),
  confirm: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that you are authorised to apply.' }),
  }),
  password: z.string().min(12).max(128).regex(/[a-z]/).regex(/[A-Z]/).regex(/\d/),
});

/**
 * POST /api/auth/google/vendor-apply
 *
 * A verified Google identity creates a PENDING vendor account. The vendor
 * cannot sell until an admin approves it; the session lets it view
 * /vendor-pending. The code/PIN pair is still generated for compatibility with
 * the legacy terminal login, but Google is the intended vendor sign-in.
 */
export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`vendor-apply:${getClientIp(request)}`, 5, 10 * 60 * 1000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many vendor requests. Try again in a few minutes.');
    }

    const ticket = await verifyGoogleVendorTicket(
      request.cookies.get(GOOGLE_VENDOR_COOKIE)?.value,
    );
    if (!ticket) {
      throw forbidden('Your vendor application session expired. Start again from the login page.');
    }

    const body = await parseJson(request, applicationSchema);
    const passwordHash = await bcrypt.hash(body.password, 12);

    const university = await prisma.university.findUnique({
      where: { id: ticket.universityId },
      select: { id: true, name: true, code: true, status: true },
    });
    if (!university || university.status !== 'ACTIVE') {
      throw forbidden('This university is not accepting vendor applications right now.');
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email: ticket.email }, { googleId: ticket.sub }] },
      select: { id: true },
    });
    if (existingUser) {
      throw conflict('This Google account already has a Kupon account. Sign in instead.');
    }

    const phoneOwner = await prisma.user.findUnique({
      where: { phone: body.phone },
      select: { id: true },
    });
    if (phoneOwner) {
      throw conflict(
        'This phone number is already registered. Sign in with Google or contact your admin.',
      );
    }

    const prefix = `V-${university.code}-`;
    const lastVendor = await prisma.vendor.findFirst({
      where: { code: { startsWith: prefix } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });
    const lastNumber = lastVendor ? Number.parseInt(lastVendor.code.slice(prefix.length), 10) : 0;
    let sequence = Number.isFinite(lastNumber) ? lastNumber + 1 : 1;
    let code = `${prefix}${String(sequence).padStart(3, '0')}`;
    while (await prisma.vendor.findUnique({ where: { code }, select: { id: true } })) {
      sequence += 1;
      code = `${prefix}${String(sequence).padStart(3, '0')}`;
    }

    // The legacy terminal PIN is generated but never disclosed to a Google
    // vendor. This keeps the existing PIN login schema usable without creating a
    // known default credential.
    const unusablePin = await bcrypt.hash(randomBytes(24).toString('hex'), 10);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          phone: body.phone,
          email: ticket.email,
          googleId: ticket.sub,
          name: body.ownerName,
          role: 'VENDOR',
          universityId: university.id,
          passwordHash,
          lastLoginAt: new Date(),
        },
      });

      const vendor = await tx.vendor.create({
        data: {
          userId: user.id,
          universityId: university.id,
          name: body.businessName,
          code,
          pin: unusablePin,
          description: body.description,
          businessRegistrationNumber: body.businessRegistrationNumber,
          physicalAddress: body.physicalAddress,
          registrationDocumentUrl: body.registrationDocumentUrl,
          settlementAccount: 'Pending bank details',
          status: 'PENDING',
          pendingBalance: 0,
          totalSettled: 0,
        },
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: university.id,
          action: 'VENDOR_APPLICATION_SUBMITTED',
          entity: 'Vendor',
          entityId: vendor.id,
          metadata: {
            businessName: body.businessName,
            ownerName: body.ownerName,
            email: ticket.email,
            code,
            university: university.code,
            channel: 'google',
          },
        },
        tx,
      );

      return { user, vendor };
    });

    const token = await signSession({
      uid: created.user.id,
      role: 'VENDOR',
      universityId: university.id,
      name: created.user.name,
      phone: created.user.phone,
    });

    const response = ok({
      vendor: { id: created.vendor.id, name: created.vendor.name, code: created.vendor.code },
      redirectTo: '/vendor-pending',
    });
    setSessionCookie(response, token);
    response.cookies.set({
      name: GOOGLE_VENDOR_COOKIE,
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
      return fail(conflict('These details are already registered. Check your phone and email.'));
    }
    return fail(error);
  }
}
