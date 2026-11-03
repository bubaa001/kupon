import type { Prisma } from '@prisma/client';
import { endOfDay, startOfDay, startOfMonth, subDays } from 'date-fns';
import { calcPaymentFees } from '@/lib/fees';
import { displayName, safeJson } from '@/lib/utils';

/** Columns every vendor sale list needs — keeps list queries narrow. */
export const paymentSelect = {
  id: true,
  reference: true,
  amount: true,
  status: true,
  createdAt: true,
  settledAt: true,
  metadata: true,
  platformFee: true,
  fee: true,
  vendorSettlement: true,
} satisfies Prisma.TransactionSelect;

export const studentSummarySelect = {
  studentId: true,
  user: { select: { name: true } },
} satisfies Prisma.StudentProfileSelect;

/**
 * Shared, vendor-only analytics helpers.
 *
 * Payment item labels live inside `Transaction.metadata` (written by the charge
 * flow) so the vendor dashboard can rank top sellers without an extra join table.
 */
export type VendorRange = 'today' | 'week' | 'month';

export const VENDOR_RANGES: VendorRange[] = ['today', 'week', 'month'];

export function parseVendorRange(value: string | null | undefined): VendorRange {
  return value === 'week' || value === 'month' ? value : 'today';
}

export function rangeBounds(range: VendorRange): { start: Date; end: Date; label: string } {
  const now = new Date();
  switch (range) {
    case 'week':
      return { start: startOfDay(subDays(now, 6)), end: endOfDay(now), label: 'This week' };
    case 'month':
      return { start: startOfMonth(now), end: endOfDay(now), label: 'This month' };
    case 'today':
    default:
      return { start: startOfDay(now), end: endOfDay(now), label: 'Today' };
  }
}

export type PaymentMetadata = Record<string, unknown>;

export function paymentMetadata(metadata: string | null | undefined): PaymentMetadata {
  const value = safeJson<unknown>(metadata, {});
  return value && typeof value === 'object' ? (value as PaymentMetadata) : {};
}

/**
 * The charge flow stores the purchased item in `metadata.note` (the vendor UI
 * sends the menu item name as the default note), while seeded payments use
 * `metadata.item`. Support both so reports are complete.
 */
export function itemLabelFrom(metadata: PaymentMetadata): string | null {
  const item = typeof metadata.item === 'string' ? metadata.item.trim() : '';
  if (item) return item;
  const note = typeof metadata.note === 'string' ? metadata.note.trim() : '';
  return note || null;
}

export type PaymentLike = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: Date;
  settledAt: Date | null;
  metadata: string | null;
  platformFee: number;
  fee: number;
  vendorSettlement: number;
  student?: { studentId: string; user: { name: string } } | null;
};

/** Amount the vendor actually earns on a settled sale (gross − platform fee). */
export function netAmountFor(payment: PaymentLike): number {
  if (payment.status !== 'SETTLED') return 0;
  if (payment.vendorSettlement > 0) return payment.vendorSettlement;
  return calcPaymentFees(payment.amount).vendorSettlement;
}

export function platformFeeFor(payment: PaymentLike): number {
  if (payment.status !== 'SETTLED') return 0;
  if (payment.platformFee > 0) return payment.platformFee;
  if (payment.fee > 0) return payment.fee;
  return calcPaymentFees(payment.amount).platformFee;
}

export type SaleRow = {
  id: string;
  reference: string;
  amount: number;
  status: string;
  createdAt: string;
  settledAt: string | null;
  item: string | null;
  note: string | null;
  studentName: string;
  studentNumber: string | null;
  net: number;
};

/** Serialises a payment for the vendor UI. Student identity is masked in lists. */
export function saleRow(payment: PaymentLike): SaleRow {
  const metadata = paymentMetadata(payment.metadata);
  const note = typeof metadata.note === 'string' && metadata.note.trim() ? metadata.note.trim() : null;
  return {
    id: payment.id,
    reference: payment.reference,
    amount: payment.amount,
    status: payment.status,
    createdAt: payment.createdAt.toISOString(),
    settledAt: payment.settledAt ? payment.settledAt.toISOString() : null,
    item: itemLabelFrom(metadata),
    note,
    studentName: payment.student ? displayName(payment.student.user.name) : 'Student',
    studentNumber: payment.student?.studentId ?? null,
    net: netAmountFor(payment),
  };
}

export type TopItem = {
  name: string;
  orders: number;
  revenue: number;
  emoji: string;
};

/**
 * Ranks sold items by revenue for the active window. Items are matched to the
 * vendor's menu by name so the row can render the same emoji the student saw.
 */
export function aggregateTopItems(
  payments: PaymentLike[],
  emojiByName: Map<string, string>,
  limit = 5,
): TopItem[] {
  const totals = new Map<string, { orders: number; revenue: number }>();
  for (const payment of payments) {
    if (payment.status !== 'SETTLED') continue;
    const name = itemLabelFrom(paymentMetadata(payment.metadata));
    if (!name) continue;
    const current = totals.get(name) ?? { orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += payment.amount;
    totals.set(name, current);
  }

  return Array.from(totals.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, limit)
    .map(([name, value]) => ({
      name,
      orders: value.orders,
      revenue: value.revenue,
      emoji: emojiByName.get(name) ?? '🍽️',
    }));
}

export function emojiLookup(items: { name: string; emoji: string }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const item of items) {
    if (!map.has(item.name)) map.set(item.name, item.emoji);
  }
  return map;
}
