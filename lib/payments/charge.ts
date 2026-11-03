import { prisma } from '@/lib/db';
import { AppError, conflict, notFound } from '@/lib/errors';
import { resolvePaymentToken } from '@/lib/qr';
import { getPaymentProvider } from '@/lib/payments';
import { randomReference } from '@/lib/utils';
import { calcAggregatorCost } from '@/lib/fees';

/**
 * Creates the PENDING payment record and atomically consumes the single-use
 * payment token. Settlement (wallet debit + vendor credit + journal) is then
 * performed by the PaymentProvider, which is independently idempotent.
 */
export async function chargeWithToken(input: {
  token?: string;
  code?: string;
  amount: number;
  vendorId: string;
  vendorUniversityId: string;
  note?: string;
}) {
  const resolved = await resolvePaymentToken({
    token: input.token,
    code: input.code,
    vendorUniversityId: input.vendorUniversityId,
  });

  if (input.amount > resolved.student.walletBalance) {
    throw new AppError(
      `Student balance is only TZS ${resolved.student.walletBalance.toLocaleString('en-US')}.`,
      402,
      'INSUFFICIENT_FUNDS',
      { available: resolved.student.walletBalance },
    );
  }

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.vendorId },
    select: { id: true, universityId: true, status: true, name: true, code: true },
  });
  if (!vendor) throw notFound('Vendor not found.');
  if (vendor.universityId !== input.vendorUniversityId) {
    throw new AppError('Cross-tenant charge blocked.', 403, 'TENANT_MISMATCH');
  }
  if (vendor.status !== 'ACTIVE') throw conflict('Vendor account is suspended.');

  const university = await prisma.university.findUnique({
    where: { id: vendor.universityId },
    select: { paymentRouteCode: true, code: true, status: true },
  });
  if (!university) throw notFound('University not found.');
  if (university.status !== 'ACTIVE') throw conflict('University is suspended.');

  const pending = await prisma.$transaction(async (tx) => {
    const consumed = await tx.paymentToken.updateMany({
      where: { id: resolved.id, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (consumed.count === 0) {
      throw conflict('This payment code was just used or expired. Ask for a new code.');
    }

    const transaction = await tx.transaction.create({
      data: {
        reference: randomReference('PAY'),
        universityId: vendor.universityId,
        studentId: resolved.student.profileId,
        vendorId: vendor.id,
        amount: input.amount,
        fee: 0,
        aggregatorFee: calcAggregatorCost(input.amount),
        type: 'PAYMENT',
        status: 'PENDING',
        routeCode: university.paymentRouteCode,
        metadata: JSON.stringify({
          vendorCode: vendor.code,
          vendorName: vendor.name,
          studentNumber: resolved.student.studentNumber,
          note: input.note ?? null,
          routeCode: university.paymentRouteCode,
          lipaNamba: university.paymentRouteCode,
          universityCode: university.code,
          paymentTokenId: resolved.id,
          provider: 'snippe-mock',
        }),
      },
    });

    await tx.paymentToken.update({
      where: { id: resolved.id },
      data: { transactionId: transaction.id },
    });

    return transaction;
  });

  const provider = getPaymentProvider();

  try {
    const settled = await provider.settlePayment(pending.id);
    const transaction = await prisma.transaction.findUnique({
      where: { id: pending.id },
      include: {
        vendor: { select: { name: true, code: true } },
        student: { include: { user: { select: { name: true, phone: true } } } },
      },
    });
    return {
      transaction,
      balance: settled.balance,
      studentName: resolved.student.name,
      studentNumber: resolved.student.studentNumber,
      vendor: vendor.name,
    };
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'Payment settlement failed.';
    await prisma.transaction.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: message },
    });
    throw error;
  }
}

/**
 * USSD/manual fallback: a feature phone cannot display a QR code. The student
 * enters their vendor code, amount and a mock PIN. In production this is
 * triggered by the telco USSD gateway with a verified MSISDN session, never by
 * an unauthenticated browser POST.
 */
export async function chargeViaUssd(input: {
  phone: string;
  vendorCode: string;
  amount: number;
  pin: string;
  universityId?: string;
}) {
  if (input.pin !== '1234') {
    throw new AppError('Incorrect USSD PIN. Demo PIN is 1234.', 401, 'INVALID_PIN');
  }

  const student = await prisma.studentProfile.findFirst({
    where: {
      user: { phone: input.phone, role: 'STUDENT' },
      ...(input.universityId ? { universityId: input.universityId } : {}),
    },
    include: {
      user: { select: { name: true, phone: true } },
      university: { select: { id: true, paymentRouteCode: true, code: true, status: true } },
    },
  });
  if (!student) {
    throw notFound('No Kupon wallet is registered to this phone number.');
  }

  const vendor = await prisma.vendor.findUnique({
    where: { code: input.vendorCode },
    include: { university: { select: { id: true, code: true, status: true } } },
  });
  if (!vendor) throw notFound('Vendor code not found.');
  if (vendor.universityId !== student.universityId) {
    throw new AppError(
      'This vendor belongs to a different university. Cross-tenant USSD payments are blocked.',
      403,
      'TENANT_MISMATCH',
    );
  }
  if (vendor.status !== 'ACTIVE') throw conflict('Vendor is suspended.');
  if (vendor.university.status !== 'ACTIVE') throw conflict('University is suspended.');

  const pending = await prisma.transaction.create({
    data: {
      reference: randomReference('USSD'),
      universityId: student.universityId,
      studentId: student.id,
      vendorId: vendor.id,
      amount: input.amount,
      fee: 0,
      aggregatorFee: calcAggregatorCost(input.amount),
      type: 'PAYMENT',
      status: 'PENDING',
      routeCode: student.university.paymentRouteCode,
      phone: student.user.phone,
      metadata: JSON.stringify({
        channel: 'USSD',
        vendorCode: vendor.code,
        vendorName: vendor.name,
        routeCode: student.university.paymentRouteCode,
        lipaNamba: student.university.paymentRouteCode,
        universityCode: student.university.code,
        provider: 'snippe-mock',
      }),
    },
  });

  const provider = getPaymentProvider();
  try {
    const settled = await provider.settlePayment(pending.id);
    return {
      transactionId: pending.id,
      balance: settled.balance,
      studentName: student.user.name,
      vendorName: vendor.name,
      amount: input.amount,
    };
  } catch (error) {
    const message = error instanceof AppError ? error.message : 'USSD payment failed.';
    await prisma.transaction.updateMany({
      where: { id: pending.id, status: 'PENDING' },
      data: { status: 'FAILED', failureReason: message },
    });
    throw error;
  }
}
