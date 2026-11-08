import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { AppError, conflict, notFound } from '@/lib/errors';
import { randomReference } from '@/lib/utils';
import { signCouponToken } from './coupon';
import { orderInclude, serializeOrder } from './serialize';
import type { PlaceOrderInput } from './types';
import { processKuponTestGatewayPayments } from '@/lib/payments/kupon-test-gateway';
import { calcOrderCheckoutFees } from '@/lib/fees';

const MAX_ITEMS = 20;
const MAX_QUANTITY = 10;
const COUPON_TTL_HOURS = 24;

function newCouponCode(): string {
  return randomInt(100000, 999999).toString();
}

async function uniqueCouponCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = newCouponCode();
    const existing = await prisma.order.findUnique({ where: { couponCode: code } });
    if (!existing) return code;
  }
  throw conflict('Could not generate a unique coupon. Please try again.');
}

/**
 * Starts a meal order and simulates a mobile-money payment through Kupon's
 * internal test gateway. The gateway automatically records receipt and
 * confirmation; no mobile-money collection occurs.
 *
 * The money path for the student-scans-vendor flow:
 *   validate tenant + menu availability + quantities
 *   → create a payment-pending order and transaction
 *   → create a test payment intent
 *   → Kupon's test gateway records received and confirmed events automatically
 *   → issue the coupon and book the vendor settlement
 *
 * The vendor later verifies the coupon; verification is an operational step and
 * never moves money a second time.
 */
export async function placeOrder(input: {
  studentProfileId: string;
  universityId: string;
  actorId: string;
  payload: PlaceOrderInput;
}) {
  if (!input.payload.items.length) {
    throw new AppError('Add at least one meal to your order.', 400, 'EMPTY_ORDER');
  }
  if (input.payload.items.length > MAX_ITEMS) {
    throw new AppError('That is too many different meals for one order.', 400, 'TOO_MANY_ITEMS');
  }

  const seen = new Set<string>();
  for (const item of input.payload.items) {
    if (seen.has(item.menuItemId)) {
      throw new AppError('Each meal can only appear once in an order.', 400, 'DUPLICATE_ITEM');
    }
    seen.add(item.menuItemId);
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > MAX_QUANTITY) {
      throw new AppError('Meal quantities must be between 1 and 10.', 400, 'BAD_QUANTITY');
    }
  }

  const student = await prisma.studentProfile.findUnique({
    where: { id: input.studentProfileId },
    include: {
      user: { select: { name: true, phone: true } },
      university: { select: { id: true, name: true, code: true, paymentRouteCode: true, status: true } },
    },
  });
  if (!student) throw notFound('Student profile not found.');
  if (student.universityId !== input.universityId) {
    throw new AppError('Cross-tenant order blocked.', 403, 'TENANT_MISMATCH');
  }
  if (student.university.status !== 'ACTIVE') {
    throw conflict('Your university is suspended. Orders are paused.');
  }
  await processKuponTestGatewayPayments({ studentId: student.id });

  const vendor = await prisma.vendor.findUnique({
    where: { id: input.payload.vendorId },
    include: { university: { select: { id: true, code: true, status: true } } },
  });
  if (!vendor) throw notFound('Vendor not found.');
  if (vendor.universityId !== student.universityId) {
    throw new AppError('This vendor belongs to another university.', 403, 'TENANT_MISMATCH');
  }
  if (vendor.status !== 'ACTIVE' || vendor.university.status !== 'ACTIVE') {
    throw conflict('This vendor is not accepting orders right now.');
  }

  const menuItems = await prisma.menuItem.findMany({
    where: {
      vendorId: vendor.id,
      universityId: student.universityId,
      id: { in: input.payload.items.map((item) => item.menuItemId) },
      approvalStatus: 'APPROVED',
      available: true,
    },
  });
  if (menuItems.length !== input.payload.items.length) {
    throw conflict('One of those meals is no longer available. Refresh the menu.');
  }

  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const orderItems = input.payload.items.map((choice) => {
    const item = byId.get(choice.menuItemId);
    if (!item) throw conflict('A selected meal is unavailable.');
    return {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity: choice.quantity,
      emoji: item.emoji,
      imageUrl: item.imageUrl,
      autoAccept: item.autoAccept,
    };
  });

  const requiresAcceptance = orderItems.some((item) => !item.autoAccept);
  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  if (total <= 0) throw new AppError('Order total must be greater than zero.', 400);
  if (total > 200_000) throw new AppError('Order total is too large for one coupon.', 400);

  const reference = randomReference('ORD');
  const couponCode = await uniqueCouponCode();
  const expiresAt = new Date(Date.now() + COUPON_TTL_HOURS * 60 * 60 * 1000);

  const created = await prisma.$transaction(async (tx) => {
    const creditAccount = input.payload.useCredit
      ? await tx.cafeteriaCredit.findUnique({
          where: {
            studentId_vendorId_isTest: {
              studentId: student.id,
              vendorId: vendor.id,
              isTest: true,
            },
          },
          select: { id: true, balance: true },
        })
      : null;
    const creditApplied = Math.min(creditAccount?.balance ?? 0, total);
    if (creditApplied > 0 && creditAccount) {
      const debited = await tx.cafeteriaCredit.updateMany({
        where: { id: creditAccount.id, balance: { gte: creditApplied } },
        data: { balance: { decrement: creditApplied } },
      });
      if (!debited.count) throw conflict('Your cafeteria credit balance changed. Try again.');
    }

    const cashAmount = total - creditApplied;
    const fees = calcOrderCheckoutFees(cashAmount);
    const paymentReference = cashAmount > 0 ? randomReference('PAY') : null;
    const transaction = paymentReference
      ? await tx.transaction.create({
          data: {
            reference: paymentReference,
            universityId: student.universityId,
            studentId: student.id,
            vendorId: vendor.id,
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
              orderReference: reference,
              couponCode,
              vendorCode: vendor.code,
              vendorName: vendor.name,
              item:
                orderItems.length === 1
                  ? orderItems[0].name
                  : `${orderItems[0].name} + ${orderItems.length - 1} more`,
              items: orderItems.map((item) => ({
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
        })
      : null;

    if (transaction) {
      await tx.paymentEvent.create({
        data: {
          transactionId: transaction.id,
          sequence: 1,
          stage: 'INITIATED',
          source: 'KUPON_TEST_GATEWAY',
        },
      });
    }

    const order = await tx.order.create({
      data: {
        reference,
        universityId: student.universityId,
        studentId: student.id,
        vendorId: vendor.id,
        status: transaction
          ? 'PAYMENT_PENDING'
          : requiresAcceptance
            ? 'AWAITING_ACCEPTANCE'
            : 'PENDING',
        total,
        creditApplied,
        requiresAcceptance,
        testOnly: true,
        itemCount,
        couponCode,
        note: input.payload.note?.trim() || null,
        transactionId: transaction?.id ?? null,
        expiresAt,
        items: { create: orderItems.map(({ autoAccept: _autoAccept, ...item }) => item) },
      },
      include: orderInclude,
    });

    if (creditApplied > 0 && creditAccount) {
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

    return { order, paymentReference };
  });

  const updatedOrder = await prisma.order.findUnique({
    where: { id: created.order.id },
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

  return {
    order: serializedOrder,
    transactionId: created.paymentReference,
    payment: {
        status: created.paymentReference ? 'PENDING' : 'SETTLED',
        message: created.paymentReference
          ? `Kupon test gateway is simulating TZS ${serializedOrder.amountPaid.toLocaleString()} payment, including TZS ${serializedOrder.apiFee.toLocaleString()} API fee. No real money is collected.`
          : updatedOrder.status === 'AWAITING_ACCEPTANCE'
            ? 'Paid with cafeteria credit. The cafeteria must accept the request before a coupon is issued.'
            : 'Order paid with cafeteria credit. No new money was collected.',
        demo: true,
        amountCharged: serializedOrder.amountPaid,
        apiFee: serializedOrder.apiFee,
        kuponFee: serializedOrder.kuponFee,
      requiresAcceptance: updatedOrder.status === 'AWAITING_ACCEPTANCE',
    },
  };
}

/** Loads and signs an order's coupon for the owning student. */
export async function getStudentOrderCoupon(studentProfileId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, studentId: studentProfileId },
    include: orderInclude,
  });
  if (!order) throw notFound('Order not found.');
  const couponToken =
    order.status === 'PAYMENT_PENDING' ||
    order.status === 'PAYMENT_FAILED' ||
    order.status === 'AWAITING_ACCEPTANCE'
      ? null
      : await signCouponToken(
          {
            orderId: order.id,
            couponCode: order.couponCode,
            vendorId: order.vendorId,
            universityId: order.universityId,
            studentId: order.studentId,
          },
          order.expiresAt,
        );
  return { order, couponToken };
}
