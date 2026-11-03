import { format } from 'date-fns';
import { formatTZS } from '@/lib/utils';

const ACTION_LABELS: Record<string, string> = {
  REFUND_APPROVED: 'Refund approved',
  REFUND_REJECTED: 'Refund rejected',
  REFUND_PAYOUT_FAILED: 'Refund payout failed',
  MENU_APPROVED: 'Menu item approved',
  MENU_REJECTED: 'Menu item rejected',
  MENU_REOPENED: 'Menu item reopened',
  VENDOR_CREATED: 'Vendor created',
  VENDOR_APPROVED: 'Vendor approved',
  VENDOR_APPLICATION_SUBMITTED: 'Vendor application submitted',
  VENDOR_SUSPENDED: 'Vendor suspended',
  VENDOR_REACTIVATED: 'Vendor reactivated',
  COUPON_VERIFIED: 'Coupon verified',
  GOOGLE_EMAIL_LINKED: 'Google email linked',
  GOOGLE_EMAIL_UNLINKED: 'Google email unlinked',
  WALLET_MANUAL_CREDIT: 'Wallet credited',
  WALLET_MANUAL_DEBIT: 'Wallet debited',
  UNIVERSITY_UPDATED: 'University profile updated',
  LIPA_NAMBA_UPDATED: 'Lipa Namba updated',
  UNIVERSITY_ONBOARDED: 'University onboarded',
  TENANT_UPDATED: 'University updated',
};

export function actionLabel(action: string): string {
  const known = ACTION_LABELS[action];
  if (known) return known;
  const words = action.replace(/_/g, ' ').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function actionTone(
  action: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'purple' {
  if (action.includes('REJECTED') || action.includes('FAILED') || action.includes('SUSPENDED')) {
    return 'danger';
  }
  if (action.includes('APPROVED') || action.includes('CREATED') || action.includes('REACTIVATED')) {
    return 'success';
  }
  if (action.includes('UPDATED') || action.includes('OPENED')) return 'purple';
  return 'neutral';
}

/** One-line human summary of an audit entry's metadata payload. */
export function auditSummary(metadata: Record<string, unknown>): string | null {
  const parts: string[] = [];
  if (typeof metadata.amount === 'number') parts.push(formatTZS(metadata.amount));
  if (typeof metadata.studentName === 'string') parts.push(metadata.studentName);
  if (typeof metadata.item === 'string') parts.push(metadata.item);
  if (typeof metadata.name === 'string' && metadata.item === undefined) parts.push(metadata.name);
  if (typeof metadata.vendorName === 'string') parts.push(metadata.vendorName);
  if (typeof metadata.code === 'string' && metadata.item === undefined) parts.push(metadata.code);
  if (typeof metadata.reason === 'string') parts.push(`“${metadata.reason}”`);
  if (typeof metadata.note === 'string' && metadata.note) parts.push(`Note: ${metadata.note}`);
  if (typeof metadata.message === 'string') parts.push(metadata.message);
  if (typeof metadata.payoutReference === 'string') {
    parts.push(`Payout ${metadata.payoutReference}`);
  }
  return parts.length > 0 ? parts.join(' • ') : null;
}

export function invoicePeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  if (Number.isNaN(date.getTime())) return period;
  return format(date, 'MMM yyyy');
}

export function rangeOptionLabel(key: string): string {
  switch (key) {
    case 'today':
      return 'Today';
    case '30d':
      return 'Last 30 days';
    case 'mtd':
      return 'This month';
    case 'all':
      return 'All time';
    default:
      return 'Last 7 days';
  }
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}
