import { prisma } from '@/lib/db';
import { auditLog } from '@/lib/audit';
import { conflict, forbidden, notFound } from '@/lib/errors';
import { orderInclude, serializeVendorOrder } from './serialize';

const COUPON_TTL_HOURS = 24;

export async function acceptOrderRequest(input: {
  orderId: string;
  vendorId: string;
  universityId: string;
  actorId: string;
}) {
  const order = await prisma.order.findFirst({
    where: {
      id: input.orderId,
      vendorId: input.vendorId,
      universityId: input.universityId,
    },
    include: orderInclude,
  });
  if (!order) throw notFound('Order request not found.');
  if (order.status !== 'AWAITING_ACCEPTANCE') {
    throw conflict('This order request is no longer waiting for acceptance.');
  }

  const pendingCredit = await prisma.creditRequest.findFirst({
    where: {
      orderId: order.id,
      status: { in: ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'] },
    },
    select: { id: true },
  });
  if (pendingCredit) throw conflict('This order has an open credit case and cannot be accepted.');

  const accepted = await prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: {
        id: order.id,
        vendorId: input.vendorId,
        universityId: input.universityId,
        status: 'AWAITING_ACCEPTANCE',
        creditRequests: {
          none: { status: { in: ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'] } },
        },
      },
      data: {
        status: 'AWAITING_PAYMENT',
        expiresAt: new Date(Date.now() + COUPON_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    if (!claimed.count) throw conflict('This order request was just handled.');
    await auditLog(
      {
        actorId: input.actorId,
        universityId: input.universityId,
        action: 'ORDER_REQUEST_ACCEPTED',
        entity: 'Order',
        entityId: order.id,
        metadata: { reference: order.reference, vendorId: input.vendorId },
      },
      tx,
    );
    return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderInclude });
  });

  return serializeVendorOrder(accepted);
}

export async function acceptAllOrderRequests(input: {
  vendorId: string;
  universityId: string;
  actorId: string;
}) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const requests = await tx.order.findMany({
      where: {
        vendorId: input.vendorId,
        universityId: input.universityId,
        status: 'AWAITING_ACCEPTANCE',
        creditRequests: {
          none: { status: { in: ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'] } },
        },
      },
      select: { id: true, reference: true },
    });
    if (requests.length === 0) return { accepted: 0 };

    const result = await tx.order.updateMany({
      where: {
        id: { in: requests.map((request) => request.id) },
        vendorId: input.vendorId,
        universityId: input.universityId,
        status: 'AWAITING_ACCEPTANCE',
        creditRequests: {
          none: { status: { in: ['PENDING_VENDOR', 'PENDING_ADMIN', 'PENDING_FINANCE'] } },
        },
      },
      data: {
        status: 'AWAITING_PAYMENT',
        expiresAt: new Date(now.getTime() + COUPON_TTL_HOURS * 60 * 60 * 1000),
      },
    });
    await auditLog(
      {
        actorId: input.actorId,
        universityId: input.universityId,
        action: 'ORDER_REQUESTS_BULK_ACCEPTED',
        entity: 'Vendor',
        entityId: input.vendorId,
        metadata: { accepted: result.count, orderReferences: requests.map((item) => item.reference) },
      },
      tx,
    );
    return { accepted: result.count };
  });
}

export async function assertOrderRequestAccess(
  orderId: string,
  vendorId: string,
  universityId: string,
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, vendorId: true, universityId: true },
  });
  if (!order) throw notFound('Order request not found.');
  if (order.vendorId !== vendorId || order.universityId !== universityId) {
    throw forbidden('This order belongs to another cafeteria.');
  }
  return order;
}
