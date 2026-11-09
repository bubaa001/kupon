import { z } from 'zod';
import { auditLog } from '@/lib/audit';
import { fail, ok, parseJson } from '@/lib/api';
import { requireApiUser, requireStudent } from '@/lib/auth';
import { conflict, notFound, tooManyRequests } from '@/lib/errors';
import { LEDGER_ACCOUNTS, postJournal } from '@/lib/ledger';
import { prisma } from '@/lib/db';
import { randomReference } from '@/lib/utils';
import { rateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const escalationSchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

const ESCALATION_FEE = 1500;

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const user = await requireApiUser(['STUDENT']);
    const student = requireStudent(user);
    const limit = await rateLimit(`student:credit-escalation:${student.id}`, 3, 10 * 60_000);
    if (!limit.allowed) {
      throw tooManyRequests('Too many escalation requests. Wait before trying again.');
    }
    const body = await parseJson(request, escalationSchema);
    const creditRequest = await prisma.creditRequest.findFirst({
      where: {
        id: params.id,
        studentId: student.id,
        status: 'APPROVED',
        kind: 'STUDENT_UNFULFILLED',
      },
      include: { order: { select: { reference: true } } },
    });
    if (!creditRequest) throw notFound('Approved cafeteria credit request not found.');
    if (await prisma.supportTicket.findUnique({ where: { creditRequestId: creditRequest.id } })) {
      throw conflict('An escalation ticket already exists for this credit request.');
    }

    const result = await prisma.$transaction(async (tx) => {
      const vendorCharge = await tx.vendor.updateMany({
        where: {
          id: creditRequest.vendorId,
          universityId: creditRequest.universityId,
        },
        data: { pendingBalance: { decrement: ESCALATION_FEE } },
      });
      if (!vendorCharge.count) throw conflict('The cafeteria account no longer exists.');

      const feeTransaction = await tx.transaction.create({
        data: {
          reference: randomReference('FEE'),
          universityId: creditRequest.universityId,
          studentId: student.id,
          vendorId: creditRequest.vendorId,
          amount: ESCALATION_FEE,
          type: 'ADJUSTMENT_DEBIT',
          status: 'SETTLED',
          isTest: true,
          metadata: JSON.stringify({
            channel: 'KUPO_TEST_ESCALATION_FEE',
            note: 'Test-only vendor escalation charge; no money moved.',
            creditRequestReference: creditRequest.reference,
          }),
          settledAt: new Date(),
        },
        select: { id: true, reference: true },
      });

      const ticket = await tx.supportTicket.create({
        data: {
          reference: randomReference('SUP'),
          creditRequestId: creditRequest.id,
          orderId: creditRequest.orderId,
          studentId: student.id,
          vendorId: creditRequest.vendorId,
          universityId: creditRequest.universityId,
          feeAmount: ESCALATION_FEE,
          feeTransactionId: feeTransaction.id,
          reason: body.reason,
        },
        select: { reference: true, status: true, feeAmount: true, createdAt: true },
      });

      await postJournal(tx, {
        transactionId: feeTransaction.id,
        universityId: creditRequest.universityId,
        description: `TEST escalation fee • ${ticket.reference} (no money moved)`,
        lines: [
          {
            account: LEDGER_ACCOUNTS.TEST_VENDOR_CHARGE,
            debit: ESCALATION_FEE,
            description: 'Simulated vendor charge for an escalation ticket',
          },
          {
            account: LEDGER_ACCOUNTS.TEST_SUPPORT_FEE_REVENUE,
            credit: ESCALATION_FEE,
            description: 'Test-only Kupon support fee',
          },
        ],
      });

      await auditLog(
        {
          actorId: user.id,
          universityId: creditRequest.universityId,
          action: 'SUPPORT_ESCALATION_OPENED',
          entity: 'SupportTicket',
          entityId: ticket.reference,
          metadata: {
            orderReference: creditRequest.order.reference,
            feeTransactionReference: feeTransaction.reference,
            feeAmount: ESCALATION_FEE,
            testOnly: true,
          },
        },
        tx,
      );

      return ticket;
    });

    return ok(
      {
        ticket: result,
        message:
          'Ticket opened. The TZS 1,500 vendor charge is recorded for testing only; no money was moved.',
      },
      { status: 201 },
    );
  } catch (error) {
    return fail(error);
  }
}
