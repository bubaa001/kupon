import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { AppError, conflict, notFound } from '@/lib/errors';
import { calcPaymentFees } from '@/lib/fees';
import { debitWallet } from '@/lib/wallet';
import { postJournal, LEDGER_ACCOUNTS } from '@/lib/ledger';
import { paymentSms, sendSms } from '@/lib/sms';
import { randomReference } from '@/lib/utils';
import { signCouponToken } from './coupon';
import { orderInclude, serializeOrder } from './serialize';
import type { PlaceOrderInput } from './types';

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
 * Places a paid meal order from a vendor menu.
 *
 * This is the money-bearing path for the student-scans-vendor flow:
 *   validate tenant + menu availability + quantities
 *   → debit the wallet exactly once (conditional update)
 *   → credit vendor pending settlement
 *   → book platform/university/aggregator fees
 *   → write a balanced double-entry journal
 *   → create the PENDING order and its item snapshots
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
      wallet: true,
    },
  });
  if (!student) throw notFound('Student profile not found.');
  if (student.universityId !== input.universityId) {
    throw new AppError('Cross-tenant order blocked.', 403, 'TENANT_MISMATCH');
  }
  if (student.university.status !== 'ACTIVE') {
    throw conflict('Your university is suspended. Orders are paused.');
  }

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
    };
  });

  const total = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0);
  if (total <= 0) throw new AppError('Order total must be greater than zero.', 400);
  if (total > 200_000) throw new AppError('Order total is too large for one coupon.', 400);

  const reference = randomReference('ORD');
  const couponCode = await uniqueCouponCode();
  const expiresAt = new Date(Date.now() + COUPON_TTL_HOURS * 60 * 60 * 1000);
  const fees = calcPaymentFees(total);
  const payable = student.wallet?.balance ?? student.walletBalance;

  if (payable < total) {
    throw new AppError(
      `Insufficient wallet balance. You have TZS ${payable.toLocaleString('en-US')}, order needs TZS ${total.toLocaleString('en-US')}.`,
      402,
      'INSUFFICIENT_FUNDS',
      { available: payable, required: total },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        reference: randomReference('PAY'),
        universityId: student.universityId,
        studentId: student.id,
        vendorId: vendor.id,
        amount: total,
        fee: fees.platformFee,
        platformFee: fees.platformFee,
        aggregatorFee: fees.aggregatorFee,
        universityRevenue: fees.universityRevenue,
        vendorSettlement: fees.vendorSettlement,
        type: 'PAYMENT',
        status: 'SETTLED',
        routeCode: student.university.paymentRouteCode,
        metadata: JSON.stringify({
          channel: 'VENDOR_QR_ORDER',
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
          routeCode: student.university.paymentRouteCode,
          lipaNamba: student.university.paymentRouteCode,
          provider: 'snippe-mock',
        }),
        settledAt: new Date(),
      },
    });

    const order = await tx.order.create({
      data: {
        reference,
        universityId: student.universityId,
        studentId: student.id,
        vendorId: vendor.id,
        status: 'PENDING',
        total,
        itemCount,
        couponCode,
        note: input.payload.note?.trim() || null,
        transactionId: transaction.id,
        expiresAt,
        items: { create: orderItems },
      },
      include: orderInclude,
    });

    const balance = await debitWallet(tx, student.id, total);

    await tx.vendor.update({
      where: { id: vendor.id },
      data: { pendingBalance: { increment: fees.vendorSettlement } },
    });

    await postJournal(tx, {
      transactionId: transaction.id,
      universityId: student.universityId,
      description: `Cafeteria order • ${vendor.name}`,
      lines: [
        { account: LEDGER_ACCOUNTS.STUDENT_WALLET, debit: total },
        { account: LEDGER_ACCOUNTS.VENDOR_PENDING, credit: fees.vendorSettlement },
        { account: LEDGER_ACCOUNTS.UNIVERSITY_REVENUE, credit: fees.universityRevenue },
        { account: LEDGER_ACCOUNTS.AGGREGATOR_PAYABLE, credit: fees.aggregatorFee },
        { account: LEDGER_ACCOUNTS.PLATFORM_REVENUE, credit: fees.platformNet },
      ],
    });

    return { order, balance, transactionId: transaction.id };
  });

  const couponToken = await signCouponToken(
    {
      orderId: result.order.id,
      couponCode: result.order.couponCode,
      vendorId: result.order.vendorId,
      universityId: result.order.universityId,
      studentId: result.order.studentId,
    },
    result.order.expiresAt,
  );

  await sendSms(
    student.user.phone,
    paymentSms(total, vendor.name, result.balance),
  );

  return {
    order: serializeOrder(result.order, couponToken),
    balance: result.balance,
    transactionId: result.transactionId,
  };
}

/** Loads and signs an order's coupon for the owning student. */
export async function getStudentOrderCoupon(studentProfileId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, studentId: studentProfileId },
    include: orderInclude,
  });
  if (!order) throw notFound('Order not found.');
  const couponToken = await signCouponToken(
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
