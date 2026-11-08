import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { fail, getClientIp, ok } from '@/lib/api';
import { AppError, conflict, tooManyRequests } from '@/lib/errors';
import { prisma } from '@/lib/db';
import { rateLimit } from '@/lib/rate-limit';
import { phoneSchema } from '@/lib/validators';
import { normalizePhone } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const institutionPhoneSchema = z
  .string()
  .trim()
  .min(9)
  .transform(normalizePhone)
  .refine((value) => /^\+255\d{9}$/.test(value), 'Enter a reliable Tanzanian phone number.');
const applicationSchema = z.object({
  ownerName: z.string().trim().min(2).max(80),
  nidaNumber: z.string().regex(/^\d{20}$/, 'Enter the 20-digit NIDA number.'),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  phone: phoneSchema,
  businessName: z.string().trim().min(2).max(80),
  universityName: z.string().trim().min(2).max(120),
  institutionPhone: institutionPhoneSchema,
  confirm: z.literal('true'),
});

const allowedDocuments = new Map([
  ['application/pdf', { signature: Buffer.from('%PDF-') }],
  ['image/jpeg', { signature: Buffer.from([0xff, 0xd8, 0xff]) }],
  ['image/png', { signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) }],
]);

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    if (!rateLimit(`vendor-application:${ip}`, 5, 60 * 60_000).allowed) {
      throw tooManyRequests('Too many applications from this network. Try again later.');
    }

    const contentLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > MAX_DOCUMENT_BYTES + 64 * 1024) {
      throw new AppError('Keep the TIN/TRA document under 5 MB.', 413, 'FILE_TOO_LARGE');
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      throw new AppError('Submit the application with its TIN/TRA document.', 400, 'INVALID_FORM_DATA');
    }

    const file = formData.get('tinDocument');
    if (!(file instanceof File)) throw new AppError('Upload your TIN/TRA document.', 400, 'DOCUMENT_REQUIRED');
    if (file.size === 0 || file.size > MAX_DOCUMENT_BYTES) {
      throw new AppError('Keep the TIN/TRA document under 5 MB.', 413, 'FILE_TOO_LARGE');
    }
    const documentType = allowedDocuments.get(file.type);
    if (!documentType) {
      throw new AppError('Upload a PDF, JPG or PNG TIN/TRA document.', 400, 'UNSUPPORTED_DOCUMENT');
    }
    const documentData = Buffer.from(await file.arrayBuffer());
    if (!documentData.subarray(0, documentType.signature.length).equals(documentType.signature)) {
      throw new AppError('The selected file does not match its document type.', 400, 'INVALID_DOCUMENT');
    }

    const rawFields = Object.fromEntries(
      Array.from(formData.entries()).filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    const body = applicationSchema.parse(rawFields);
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

    const documentKey = `vendor-tin-${randomUUID()}.private`;
    const application = await prisma.$transaction(async (tx) => {
      await tx.storedFile.create({
        data: {
          key: documentKey,
          contentType: file.type,
          data: documentData,
          size: documentData.byteLength,
        },
      });
      return tx.vendorApplication.create({
        data: {
          ownerName: body.ownerName,
          nidaNumber: body.nidaNumber,
          email: body.email,
          phone: body.phone,
          businessName: body.businessName,
          universityName: body.universityName,
          institutionPhone: body.institutionPhone,
          tinDocumentKey: documentKey,
        },
        select: { id: true, createdAt: true },
      });
    });

    return ok(
      {
        application: { id: application.id, createdAt: application.createdAt.toISOString() },
        message:
          'Application received. The platform administrator will review your details and TIN/TRA document before approval.',
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
