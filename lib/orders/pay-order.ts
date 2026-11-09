import { z } from 'zod';
import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { conflict, notFound } from '@/lib/errors';
import { randomReference } from '@/lib/utils';
import { calcOrderCheckoutFees } from '@/lib/fees';
import { signCouponToken } from './coupon';
import { orderInclude, serializeOrder } from './serialize';

const COUPON_TTL_HOURS = 24;

export async function payApprovedOrder(input: {
  orderId: string;
  studentProfileId: string;
  actorId: string;
  useCredit?: boolean;
}) {
  const order = await prisma.order.findFirst({
    where: { id: input.orderId, studentId: input.studentProfileId },
    include: { ...orderInclude, items: true },
  });
  if (!order) throw notFound('Order not found.');
  if (order.status !== 'AWAITING_PAYMENT') {
    throw conflict('This order must be approved by the cafeteria before payment.');
  }
  if (order.expiresAt <= new Date()) {
    throw conflict('This order request expired. Please place a new order.');
  }
  const useCredit = input.useCredit ?? order.useCafeteriaCredit;

  const expiresAt = new Date(Date.now() + COUPON_TTL_HOURS * 60 * 60 * 1000);
  const result = await prisma.$transaction(async (tx) => {
    const creditAccount = useCredit
      ? await tx.cafeteriaCredit.findUnique({
          where: {
            studentId_vendorId_isTest: {
              studentId: input.studentProfileId,
              vendorId: order.vendorId,
              isTest: true,
            },
          },
          select: { id: true, balance: true },
        })
      : null;
    const creditApplied = Math.min(creditAccount?.balance ?? 0, order.total);
    const cashAmount = order.total - creditApplied;
    const fees = calcOrderCheckoutFees(cashAmount);
    const now = new Date();
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        studentId: input.studentProfileId,
        status: 'AWAITING_PAYMENT',
        transactionId: null,
        expiresAt: { gt: now },
      },
      data: {
        status: cashAmount > 0 ? 'PAYMENT_PENDING' : 'PENDING',
        creditApplied,
        useCafeteriaCredit: useCredit,
        expiresAt,
      },
    });
    if (!claimed.count) throw conflict('This request was already paid, expired, or changed.');

    if (creditApplied > 0 && creditAccount) {
      const debited = await tx.cafeteriaCredit.updateMany({
        where: { id: creditAccount.id, balance: { gte: creditApplied } },
        data: { balance: { decrement: creditApplied } },
      });
      if (!debited.count) throw conflict('Your cafeteria credit balance changed. Try again.');
      const updatedAccount = await tx.cafeteriaCredit.findUniqueOrThrow({
        where: { id: creditAccount.id },
        select: { balance: true },
      });
      await tx.creditMovement.create({
        data: {
          reference: randomReference('CRD'),
          creditId: creditAccount.id,
          orderId: order.id,
          kind: 'SPEND',
          amount: creditApplied,
          balanceAfter: updatedAccount.balance,
          createdById: input.actorId,
        },
      });
    }

    if (cashAmount === 0) {
      await auditLog(
        {
          actorId: input.actorId,
          universityId: order.universityId,
          action: 'ORDER_PAID_WITH_CAFETERIA_CREDIT',
          entity: 'Order',
          entityId: order.id,
          metadata: { reference: order.reference, creditApplied },
        },
        tx,
      );
      return { paymentReference: null, creditApplied };
    }

    const paymentReference = randomReference('PAY');
    const payment = await tx.transaction.create({
      data: {
        reference: paymentReference,
        universityId: order.universityId,
        studentId: order.studentId,
        vendorId: order.vendorId,
        amount: fees.amountCharged,
        fee: fees.apiFee + fees.kuponFee,
        platformFee: fees.kuponFee,
        aggregatorFee: fees.apiFee,
        vendorSettlement: fees.vendorSettlement,
        type: 'PAYMENT',
        status: 'PENDING',
        isTest: true,
        metadata: JSON.stringify({
          channel: 'MOBILE_MONEY_ORDER',
          orderReference: order.reference,
          couponCode: order.couponCode,
          vendorCode: order.vendor.code,
          vendorName: order.vendor.name,
          item: order.items.length === 1 ? order.items[0].name : `${order.items[0].name} + ${order.items.length - 1} more`,
          items: order.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price,
          })),
          creditApplied,
          gatewayFee: fees.apiFee,
          kuponFee: fees.kuponFee,
          vendorSettlement: fees.vendorSettlement,
          provider: 'kupon-test-gateway',
          stage: 'INITIATED',
        }),
      },
    });
    await tx.paymentEvent.create({
      data: {
        transactionId: payment.id,
        sequence: 1,
        stage: 'INITIATED',
        source: 'KUPON_TEST_GATEWAY',
      },
    });
    await tx.order.update({
      where: { id: order.id },
      data: { transactionId: payment.id },
    });
    await auditLog(
      {
        actorId: input.actorId,
        universityId: order.universityId,
        action: 'ORDER_PAYMENT_STARTED',
        entity: 'Order',
        entityId: order.id,
        metadata: { reference: order.reference, paymentReference, creditApplied },
      },
      tx,
    );
    return { paymentReference, creditApplied };
  });

  const updatedOrder = await prisma.order.findUnique({
    where: { id: order.id },
    include: orderInclude,
  });
  if (!updatedOrder) throw notFound('The order could not be loaded.');
  const couponToken =
    updatedOrder.status === 'PENDING'
      ? await signCouponToken(
          {
            orderId: updatedOrder.id,
            couponCode: updatedOrder.couponCode,
            vendorId: updatedOrder.vendorId,
            universityId: updatedOrder.universityId,
            studentId: updatedOrder.studentId,
          },
          updatedOrder.expiresAt,
        )
      : null;

  const serializedOrder = serializeOrder(updatedOrder, couponToken);
  const paymentStage = updatedOrder.transaction?.paymentEvents[0]?.stage;
  return {
    order: serializedOrder,
    transactionId: result.paymentReference,
    payment: {
      status: result.paymentReference ? 'PENDING' : 'SETTLED',
      message: result.paymentReference
        ? `Kupon test gateway is simulating TZS ${serializedOrder.amountPaid.toLocaleString()} payment. No real money is collected.`
        : 'Your cafeteria credit covered the approved order. No new money was collected.',
      demo: true,
      amountCharged: serializedOrder.amountPaid,
      apiFee: serializedOrder.apiFee,
      kuponFee: serializedOrder.kuponFee,
      requiresAcceptance: false,
      paymentStage: paymentStage ?? null,
    },
  };
}
