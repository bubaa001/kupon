'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  Banknote,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  SearchX,
  XCircle,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { RefundStatusBadge } from '@/components/ui/status-badge';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PAYOUT_STATUS_LABEL } from '@/lib/constants';
import type { AdminMoneyRequestView, MoneyRequestListData } from '@/lib/payments/money-request-types';
import { formatTZS, relativeTime } from '@/lib/utils';
import { queryString, useApiData } from '../_components/hooks';
import { RangeTabs, SectionCard, TableEmpty } from '../_components/ui-bits';
import { WithdrawalDetailDialog, WithdrawalReviewDialog } from './_components/dialogs';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All withdrawals' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

function PayoutBadge({ request }: { request: AdminMoneyRequestView }) {
  if (!request.payoutStatus) {
    return <span className="text-[11px] text-slate-400">—</span>;
  }
  const variant =
    request.payoutStatus === 'SETTLED'
      ? 'success'
      : request.payoutStatus === 'FAILED'
        ? 'danger'
        : 'warning';
  return (
    <Badge variant={variant}>
      {PAYOUT_STATUS_LABEL[request.payoutStatus] ?? request.payoutStatus}
    </Badge>
  );
}

export default function AdminWithdrawalsPage() {
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [review, setReview] = useState<AdminMoneyRequestView | null>(null);
  const [detail, setDetail] = useState<AdminMoneyRequestView | null>(null);

  const url = useMemo(
    () =>
      `/api/admin/withdrawals${queryString({
        status: status === 'ALL' ? undefined : status,
      })}`,
    [status],
  );
  const { data, error, loading, reload } = useApiData<MoneyRequestListData>(url);
  const requests = data?.requests ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Student payouts"
        title="Withdrawals"
        description="Students cashing out available wallet balance to mobile money. Approving debits the wallet exactly once and pays out through the payment provider — this is not an order refund."
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/refunds">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Order refunds</span>
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <Alert variant="info" title="Withdrawal ≠ refund">
        A withdrawal moves money <span className="font-semibold">out of the wallet</span> to the
        student&apos;s mobile money and is not tied to any order. Order refunds live in{' '}
        <Link href="/admin/refunds" className="font-semibold underline">
          Order refunds
        </Link>
        .
      </Alert>

      {error ? (
        <Alert variant="danger" title="Could not load withdrawal requests">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageSkeleton />
      ) : error && !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Pending withdrawals"
              value={data ? String(data.summary.pending) : '—'}
              icon={Banknote}
              accent="amber"
              hint={
                data ? `${formatTZS(data.summary.pendingAmount)} to cash out` : 'Loading…'
              }
            />
            <StatCard
              label="Approved"
              value={data ? String(data.summary.approved) : '—'}
              icon={CheckCircle2}
              accent="emerald"
              hint={
                data ? `${formatTZS(data.summary.approvedAmount)} paid out` : 'Loading…'
              }
            />
            <StatCard
              label="Rejected"
              value={data ? String(data.summary.rejected) : '—'}
              icon={XCircle}
              accent="rose"
              hint={
                data ? `${formatTZS(data.summary.rejectedAmount)} kept in wallets` : 'Loading…'
              }
            />
            <StatCard
              label="All withdrawals"
              value={data ? String(data.summary.total) : '—'}
              icon={ListChecks}
              accent="sky"
              hint="Every cash-out request ever filed"
            />
          </div>

          <SectionCard contentClassName="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <RangeTabs value={status} onChange={setStatus} options={STATUS_OPTIONS} />
              <p className="text-[11px] text-slate-400">
                Pending requests are reviewed oldest first in the queue.
              </p>
            </div>

            {requests.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Reference</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Payout</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Requested</TableHead>
                      <TableHead>Reviewed</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <p className="font-mono text-[11px] font-semibold text-slate-700">
                            {request.reference}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="text-xs font-medium text-slate-800">
                            {request.student.name}
                          </p>
                          <p className="font-mono text-[10px] text-slate-400">
                            {request.student.studentId}
                          </p>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="text-xs font-semibold tabular text-slate-900">
                            {formatTZS(request.amount)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[220px] truncate text-[11px] text-slate-600">
                            {request.reason}
                          </p>
                        </TableCell>
                        <TableCell>
                          <PayoutBadge request={request} />
                        </TableCell>
                        <TableCell>
                          <RefundStatusBadge status={request.status} />
                        </TableCell>
                        <TableCell>
                          <span className="text-[11px] text-slate-500">
                            {relativeTime(request.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          {request.reviewedBy ? (
                            <div>
                              <p className="text-[11px] text-slate-600">{request.reviewedBy}</p>
                              <p className="text-[10px] text-slate-400">
                                {request.reviewedAt ? relativeTime(request.reviewedAt) : ''}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {request.status === 'PENDING' ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => setReview(request)}
                              >
                                Review
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setDetail(request)}
                              >
                                Details
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <TableEmpty
                icon={status === 'PENDING' ? CheckCircle2 : SearchX}
                title={
                  status === 'PENDING'
                    ? 'Inbox zero — no withdrawals waiting'
                    : 'No withdrawal requests here'
                }
                description={
                  status === 'PENDING'
                    ? 'Every cash-out request has been reviewed. New ones will appear here immediately.'
                    : 'When students ask to move wallet balance to mobile money, their requests land in this queue.'
                }
                action={
                  status !== 'ALL' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus('ALL')}
                    >
                      View all withdrawals
                    </Button>
                  ) : undefined
                }
              />
            )}
          </SectionCard>
        </>
      )}

      <WithdrawalReviewDialog
        withdrawal={review}
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        onReviewed={reload}
      />

      <WithdrawalDetailDialog
        withdrawal={detail}
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      />
    </div>
  );
}
