import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { fail, getClientIp, ok, parseJson } from '@/lib/api';
import { conflict, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { phoneSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const applicationSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  applicantRole: z.enum(['OWNER', 'AUTHORIZED_REPRESENTATIVE']),
  authorizationDocumentUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.startsWith('https://'), 'Use a secure HTTPS document link.')
    .optional()
    .or(z.literal('')),
  businessName: z.string().trim().min(2).max(80),
  universityName: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10).max(500),
  businessRegistrationNumber: z.string().trim().min(3).max(80),
  physicalAddress: z.string().trim().min(8).max(250),
  registrationDocumentUrl: z
    .string()
    .trim()
    .url()
    .max(500)
    .refine((value) => value.startsWith('https://'), 'Use a secure HTTPS document link.'),
  confirm: z.literal(true),
}).superRefine((application, context) => {
  if (
    application.applicantRole === 'AUTHORIZED_REPRESENTATIVE' &&
    !application.authorizationDocumentUrl
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['authorizationDocumentUrl'],
      message: 'Provide proof that you are authorised to represent this business.',
    });
  }
});

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(`vendor-application:${ip}`, 5, 60 * 60_000).allowed) {
      throw tooManyRequests('Too many applications from this network. Try again later.');
    }

    const body = await parseJson(request, applicationSchema);
    const [existingUser, existingApplication] = await Promise.all([
      prisma.user.findFirst({
        where: { OR: [{ email: body.email }, { phone: body.phone }] },
        select: { id: true },
      }),
      prisma.vendorApplication.findFirst({
        where: {
          email: body.email,
          status: { in: ['PENDING', 'APPROVED', 'COMPLETED'] },
        },
        select: { id: true, status: true },
      }),
    ]);

    if (existingUser) {
      throw conflict('These details already belong to a Kupon account. Sign in instead.');
    }
    if (existingApplication?.status === 'APPROVED') {
      throw conflict('This request is approved. Continue with Google using this email.');
    }
    if (existingApplication) {
      throw conflict('A request for this email is already being reviewed.');
    }

    const application = await prisma.vendorApplication.create({
      data: {
        ownerName: body.ownerName,
        email: body.email,
        phone: body.phone,
        applicantRole: body.applicantRole,
        authorizationDocumentUrl: body.authorizationDocumentUrl || null,
        businessName: body.businessName,
        universityName: body.universityName,
        city: body.city,
        description: body.description,
        businessRegistrationNumber: body.businessRegistrationNumber,
        physicalAddress: body.physicalAddress,
        registrationDocumentUrl: body.registrationDocumentUrl,
      },
      select: { id: true, createdAt: true },
    });

    return ok(
      {
        application: { id: application.id, createdAt: application.createdAt.toISOString() },
        message:
          'Application received. After the platform administrator approves it, continue with Google using this email.',
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return fail(conflict('A request with these details already exists.'));
    }
    return fail(error);
  }
}
