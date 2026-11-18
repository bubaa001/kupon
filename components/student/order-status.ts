/** Plain-language order status for buyers. Every label is words, never colour alone. */
export const ORDER_STATUS_META: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }
> = {
  AWAITING_ACCEPTANCE: { label: 'Waiting for cafeteria', variant: 'warning' },
  AWAITING_PAYMENT: { label: 'Ready to pay', variant: 'gold' },
  PAYMENT_PENDING: { label: 'Paying', variant: 'warning' },
  PAYMENT_FAILED: { label: 'Payment failed', variant: 'danger' },
  PENDING: { label: 'Ready to collect', variant: 'success' },
  VERIFIED: { label: 'Collected', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  EXPIRED: { label: 'Expired', variant: 'neutral' },
};

export function orderStatusMeta(status: string | null | undefined) {
  return (status && ORDER_STATUS_META[status]) || { label: 'Order', variant: 'neutral' as const };
}

/** "Pilau Beef ×2, Chips +1 more" style summary of what was ordered. */
export function dishSummary(
  items: Array<{ name: string; quantity: number }>,
  itemCount: number,
): string {
  if (!items.length) return 'Cafeteria meal';
  const shown = items.slice(0, 2).map((item) =>
    item.quantity > 1 ? `${item.name} ×${item.quantity}` : item.name,
  );
  const shownUnits = items.slice(0, 2).reduce((sum, item) => sum + item.quantity, 0);
  const more = Math.max(0, itemCount - shownUnits);
  return more > 0 ? `${shown.join(', ')} +${more} more` : shown.join(', ');
}
