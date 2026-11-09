import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/db';
import { AppError, conflict, notFound } from '@/lib/errors';
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
 * Records a student's meal request without charging them. Manual requests wait
 * for cafeteria approval; auto-accepted items can proceed directly to payment.
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
    const order = await tx.order.create({
      data: {
        reference,
        universityId: student.universityId,
        studentId: student.id,
        vendorId: vendor.id,
        status: requiresAcceptance ? 'AWAITING_ACCEPTANCE' : 'AWAITING_PAYMENT',
        total,
        creditApplied: 0,
        useCafeteriaCredit: input.payload.useCredit === true,
        requiresAcceptance,
        testOnly: true,
        itemCount,
        couponCode,
        note: input.payload.note?.trim() || null,
        expiresAt,
        items: { create: orderItems.map(({ autoAccept: _autoAccept, ...item }) => item) },
      },
      include: orderInclude,
    });

    return order;
  });

  const updatedOrder = await prisma.order.findUnique({
    where: { id: created.id },
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
    transactionId: null,
    payment: {
      status: updatedOrder.status,
      message:
        updatedOrder.status === 'AWAITING_ACCEPTANCE'
          ? 'Your request is waiting for the cafeteria to confirm the food is available. You will pay after approval.'
          : 'Your request is approved for payment. Pay to receive your coupon.',
      demo: true,
      amountCharged: 0,
      apiFee: 0,
      kuponFee: 0,
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
    order.status === 'AWAITING_ACCEPTANCE' ||
    order.status === 'AWAITING_PAYMENT'
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
