import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, conflict } from '@/lib/errors';

export async function creditWallet(
  tx: Prisma.TransactionClient,
  studentProfileId: string,
  amount: number,
) {
  await tx.wallet.upsert({
    where: { studentId: studentProfileId },
    create: { studentId: studentProfileId, balance: amount, currency: 'TZS' },
    update: { balance: { increment: amount } },
  });
  const profile = await tx.studentProfile.update({
    where: { id: studentProfileId },
    data: { walletBalance: { increment: amount } },
    select: { walletBalance: true },
  });
  return profile.walletBalance;
}

/**
 * Conditional debit: the UPDATE only succeeds when the wallet can cover the
 * amount. This prevents two concurrent QR scans from overdrawing a wallet.
 */
export async function debitWallet(
  tx: Prisma.TransactionClient,
  studentProfileId: string,
  amount: number,
) {
  const result = await tx.wallet.updateMany({
    where: { studentId: studentProfileId, balance: { gte: amount } },
    data: { balance: { decrement: amount } },
  });

  if (result.count === 0) {
    const wallet = await tx.wallet.findUnique({ where: { studentId: studentProfileId } });
    throw new AppError(
      `Insufficient wallet balance. Available ${wallet?.balance ?? 0} TZS, needed ${amount} TZS.`,
      402,
      'INSUFFICIENT_FUNDS',
      { available: wallet?.balance ?? 0, required: amount },
    );
  }

  const profile = await tx.studentProfile.update({
    where: { id: studentProfileId },
    data: { walletBalance: { decrement: amount } },
    select: { walletBalance: true },
  });
  return profile.walletBalance;
}

/**
 * Self-healing wallet bootstrap. A StudentProfile should always have exactly one
 * Wallet, but a partial signup or a restored database can leave a profile
 * without one. Never leave the student with an unusable dashboard.
 */
export async function ensureStudentWallet(studentProfileId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    select: { walletBalance: true },
  });
  if (!profile) throw new AppError('Student wallet not found.', 404, 'WALLET_NOT_FOUND');

  const wallet = await prisma.wallet.upsert({
    where: { studentId: studentProfileId },
    update: {},
    create: {
      studentId: studentProfileId,
      balance: profile.walletBalance,
      currency: 'TZS',
    },
  });

  return { wallet, balance: wallet.balance };
}

export async function getWalletSummary(studentProfileId: string) {
  const student = await prismaStudent(studentProfileId);
  return {
    balance: student.wallet?.balance ?? student.walletBalance,
    currency: student.wallet?.currency ?? 'TZS',
    studentId: student.studentId,
    name: student.user.name,
    university: student.university.name,
  };
}

async function prismaStudent(studentProfileId: string) {
  const student = await prisma.studentProfile.findUnique({
    where: { id: studentProfileId },
    include: {
      wallet: true,
      user: { select: { name: true } },
      university: { select: { name: true } },
    },
  });
  if (!student) throw new AppError('Student wallet not found.', 404, 'WALLET_NOT_FOUND');
  return student;
}

/** Vendor settlement moves money from pending to the vendor's bank payout lot. */
export async function markVendorPaid(
  tx: Prisma.TransactionClient,
  vendorId: string,
  amount: number,
) {
  const result = await tx.vendor.updateMany({
    where: { id: vendorId, pendingBalance: { gte: amount } },
    data: { pendingBalance: { decrement: amount }, totalSettled: { increment: amount } },
  });
  if (result.count === 0) {
    throw conflict('Vendor pending balance is lower than the requested settlement.');
  }
}
