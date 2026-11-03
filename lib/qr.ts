import { randomInt, randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';
import { AppError, conflict, forbidden, notFound } from '@/lib/errors';
import { QR_TTL_SECONDS } from '@/lib/constants';

const qrSecret = new TextEncoder().encode(`${env.JWT_SECRET}:qr`);
const ISSUER = 'kupon-qr';
const AUDIENCE = 'kupon-vendor';

export type QrPayload = {
  jti: string;
  studentId: string;
  universityId: string;
  code: string;
  exp: number;
  iat: number;
};

function sixDigitCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Creates a single-use, 120-second payment token.
 *
 * Two representations are returned:
 *  - a signed JWT rendered as a QR code (the student shows this to a vendor)
 *  - a 6-digit code for the USSD/manual fallback
 *
 * The JWT is only a pointer: the authoritative state is the PaymentToken row,
 * which the vendor API locks and marks used inside the charge transaction.
 */
export async function createPaymentToken(input: {
  studentProfileId: string;
  universityId: string;
  studentName: string;
  studentNumber: string;
}) {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + QR_TTL_SECONDS * 1000);

  let code = sixDigitCode();
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await prisma.paymentToken.findUnique({ where: { code } });
    if (!existing) break;
    code = sixDigitCode();
  }

  await prisma.paymentToken.create({
    data: {
      id: tokenId,
      code,
      studentId: input.studentProfileId,
      universityId: input.universityId,
      expiresAt,
    },
  });

  const token = await new SignJWT({
    studentId: input.studentProfileId,
    universityId: input.universityId,
    code,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(tokenId)
    .setJti(tokenId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${QR_TTL_SECONDS}s`)
    .sign(qrSecret);

  return {
    token,
    tokenId,
    code,
    expiresAt: expiresAt.toISOString(),
    expiresIn: QR_TTL_SECONDS,
    qrPayload: token,
    student: {
      name: input.studentName,
      studentId: input.studentNumber,
    },
  };
}

export async function verifyQrJwt(token: string): Promise<QrPayload> {
  try {
    const { payload } = await jwtVerify(token, qrSecret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.jti || typeof payload.studentId !== 'string') {
      throw new Error('Malformed token');
    }
    return {
      jti: payload.jti,
      studentId: payload.studentId,
      universityId: String(payload.universityId),
      code: String(payload.code),
      exp: Number(payload.exp),
      iat: Number(payload.iat),
    };
  } catch {
    throw new AppError(
      'This payment QR has expired or is not a Kupon code. Ask the student to refresh it.',
      400,
      'INVALID_QR',
    );
  }
}

/**
 * Resolves either a QR JWT or a 6-digit code to an active token and validates the
 * vendor's tenant. Never exposes the student's full phone number or balance.
 */
export async function resolvePaymentToken(input: {
  token?: string;
  code?: string;
  vendorUniversityId: string;
}) {
  if (!input.token && !input.code) {
    throw new AppError('Scan a QR code or enter a 6-digit payment code.', 400, 'TOKEN_REQUIRED');
  }

  let tokenId: string | undefined;
  if (input.token) {
    const payload = await verifyQrJwt(input.token);
    tokenId = payload.jti;
  }

  const record = tokenId
    ? await prisma.paymentToken.findUnique({
        where: { id: tokenId },
        include: {
          student: { include: { user: { select: { name: true, phone: true } } } },
          university: { select: { id: true, name: true, code: true } },
        },
      })
    : await prisma.paymentToken.findUnique({
        where: { code: input.code! },
        include: {
          student: { include: { user: { select: { name: true, phone: true } } } },
          university: { select: { id: true, name: true, code: true } },
        },
      });

  if (!record) throw notFound('This payment code was not found. Ask the student to refresh it.');
  if (record.universityId !== input.vendorUniversityId) {
    throw forbidden('This code belongs to a student from another university.');
  }
  if (record.usedAt) {
    throw conflict('This payment code has already been used. Ask the student for a new one.');
  }
  if (record.expiresAt.getTime() <= Date.now()) {
    throw new AppError(
      'This payment code expired after 2 minutes. Ask the student to refresh it.',
      410,
      'TOKEN_EXPIRED',
    );
  }

  return {
    id: record.id,
    code: record.code,
    universityId: record.universityId,
    expiresAt: record.expiresAt,
    student: {
      profileId: record.studentId,
      name: record.student.user.name,
      studentNumber: record.student.studentId,
      walletBalance: record.student.walletBalance,
      course: record.student.course,
      university: record.university.name,
    },
  };
}
