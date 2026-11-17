import Link from 'next/link';
import { Alert } from '@/components/ui/alert';
import type { CafeteriaNotice } from '@/lib/orders/types';

/** Headline for a cafeteria notice, for titles and toasts. */
export function cafeteriaNoticeTitle(notice: CafeteriaNotice): string {
  if (notice.kind === 'DECLINED') return 'The cafeteria declined your request';
  if (notice.caseStatus === 'APPROVED') return 'Credit approved for this meal';
  if (notice.caseStatus === 'REJECTED') return 'Your coupon is valid again';
  return 'The cafeteria cannot serve this meal';
}

/** One-line summary of what happens next, for toasts and cards. */
export function cafeteriaNoticeSummary(notice: CafeteriaNotice): string {
  if (notice.kind === 'DECLINED') return 'You were not charged.';
  if (notice.caseStatus === 'APPROVED') return 'Cafeteria credit was added to your account.';
  if (notice.caseStatus === 'REJECTED') return 'The review found the meal can be served.';
  return 'Kupon is reviewing it. If approved, you get cafeteria credit.';
}

/** Full explanation shown on the student's order. */
export function CafeteriaNoticeAlert({ notice }: { notice: CafeteriaNotice }) {
  const variant =
    notice.kind === 'DECLINED'
      ? 'warning'
      : notice.caseStatus === 'APPROVED'
        ? 'success'
        : notice.caseStatus === 'REJECTED'
          ? 'info'
          : 'warning';

  return (
    <Alert variant={variant} title={cafeteriaNoticeTitle(notice)}>
      <span className="block">
        <span className="font-semibold">Cafeteria&rsquo;s reason:</span> {notice.reason}
      </span>
      {notice.kind === 'DECLINED' ? (
        <span className="mt-1 block">No payment was taken. You can order something else.</span>
      ) : notice.caseStatus === 'OPEN' ? (
        <span className="mt-1 block">
          Your coupon is on hold while Kupon reviews case {notice.caseReference}. If it is
          approved, the amount comes back as credit at this cafeteria. No action is needed from
          you.
        </span>
      ) : notice.caseStatus === 'APPROVED' ? (
        <span className="mt-1 block">
          The amount was added as credit at this cafeteria.{' '}
          {notice.resolution ? `Note: ${notice.resolution} ` : ''}
          <Link href="/student/credit-requests" className="font-semibold underline">
            See your credit
          </Link>
        </span>
      ) : (
        <span className="mt-1 block">
          {notice.resolution ? `${notice.resolution} ` : ''}Show your coupon at the counter as
          usual.
        </span>
      )}
    </Alert>
  );
}
