import type { Prisma } from '@prisma/client';
import { auditLog } from '@/lib/audit';
import { conflict } from '@/lib/errors';
import { randomReference } from '@/lib/utils';

type CreditRequestForIssue = {
  id: string;
  reference: string;
  orderId: string;
  studentId: string;
  vendorId: string;
  universityId: string;
  amount: number;
};

export async function issueCafeteriaCredit(input: {
  tx: Prisma.TransactionClient;
  request: CreditRequestForIssue;
  expectedStatus: 'PENDING_VENDOR' | 'PENDING_FINANCE';
  actorId: string;
}) {
  const order = await input.tx.order.findUnique({
    where: { id: input.request.orderId },
    select: {
      studentId: true,
      vendorId: true,
      universityId: true,
      testOnly: true,
      transaction: { select: { isTest: true } },
    },
  });
  if (
    !order ||
    order.studentId !== input.request.studentId ||
    order.vendorId !== input.request.vendorId ||
    order.universityId !== input.request.universityId
  ) {
    throw conflict('The credit request no longer matches its order.');
  }
  const isTest = order.testOnly || order.transaction?.isTest === true;

  const claimed = await input.tx.creditRequest.updateMany({
    where: { id: input.request.id, status: input.expectedStatus },
    data: {
      status: 'APPROVED',
      reviewedById: input.actorId,
      reviewedAt: new Date(),
      ...(input.expectedStatus === 'PENDING_VENDOR' ? { vendorReviewedAt: new Date() } : {}),
    },
  });
  if (!claimed.count) throw conflict('This credit request was already reviewed.');

  const account = await input.tx.cafeteriaCredit.upsert({
    where: {
      studentId_vendorId_isTest: {
        studentId: input.request.studentId,
        vendorId: input.request.vendorId,
        isTest,
      },
    },
    create: {
      studentId: input.request.studentId,
      vendorId: input.request.vendorId,
      isTest,
      balance: input.request.amount,
    },
    update: { balance: { increment: input.request.amount } },
  });

  await input.tx.creditMovement.create({
    data: {
      reference: randomReference('CRD'),
      creditId: account.id,
      creditRequestId: input.request.id,
      orderId: input.request.orderId,
      kind: 'ISSUE',
      amount: input.request.amount,
      balanceAfter: account.balance,
      createdById: input.actorId,
    },
  });

  await auditLog(
    {
      actorId: input.actorId,
      universityId: input.request.universityId,
      action: 'CAFETERIA_CREDIT_ISSUED',
      entity: 'CreditRequest',
      entityId: input.request.id,
      metadata: {
        reference: input.request.reference,
        amount: input.request.amount,
        vendorId: input.request.vendorId,
      },
    },
    input.tx,
  );

  return account;
}
