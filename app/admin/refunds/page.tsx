'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRightLeft,
  CheckCircle2,
  ListChecks,
  RefreshCw,
  RotateCcw,
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
import type { MoneyRequestListData } from '@/lib/payments/money-request-types';
import { formatTZS, relativeTime } from '@/lib/utils';
import { queryString, useApiData } from '../_components/hooks';
import { RangeTabs, SectionCard, TableEmpty } from '../_components/ui-bits';
import { OrderRefundDetailDialog, OrderRefundReviewDialog } from './_components/dialogs';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All refunds' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function AdminOrderRefundsPage() {
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [review, setReview] = useState<MoneyRequestListData['requests'][number] | null>(null);
  const [detail, setDetail] = useState<MoneyRequestListData['requests'][number] | null>(null);

  const url = useMemo(
    () =>
      `/api/admin/refunds${queryString({
        status: status === 'ALL' ? undefined : status,
      })}`,
    [status],
  );
  const { data, error, loading, reload } = useApiData<MoneyRequestListData>(url);
  const requests = data?.requests ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Order money return"
        title="Order refunds"
        description="Refunds for specific paid orders that a vendor verified. Approving re-credits the student wallet and reverses that order's vendor pending credit and fees exactly once."
        actions={
          <>
            <Button asChild type="button" variant="outline" size="sm">
              <Link href="/admin/withdrawals">
                <ArrowRightLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Withdrawals</span>
              </Link>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={reload} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      <Alert variant="info" title="Refund ≠ withdrawal">
        An order refund reverses one verified order and returns the money{' '}
        <span className="font-semibold">into the wallet</span>. Cash-outs that send wallet balance
        to mobile money live in{' '}
        <Link href="/admin/withdrawals" className="font-semibold underline">
          Withdrawals
        </Link>
        .
      </Alert>

      {error ? (
        <Alert variant="danger" title="Could not load refund requests">
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
              label="Pending refunds"
              value={data ? String(data.summary.pending) : '—'}
              icon={RotateCcw}
              accent="amber"
              hint={
                data ? `${formatTZS(data.summary.pendingAmount)} to return` : 'Loading…'
              }
            />
            <StatCard
              label="Approved"
              value={data ? String(data.summary.approved) : '—'}
              icon={CheckCircle2}
              accent="emerald"
              hint={
                data ? `${formatTZS(data.summary.approvedAmount)} returned to wallets` : 'Loading…'
              }
            />
            <StatCard
              label="Rejected"
              value={data ? String(data.summary.rejected) : '—'}
              icon={XCircle}
              accent="rose"
              hint={
                data ? `${formatTZS(data.summary.rejectedAmount)} kept as-is` : 'Loading…'
              }
            />
            <StatCard
              label="All refunds"
              value={data ? String(data.summary.total) : '—'}
              icon={ListChecks}
              accent="sky"
              hint="Every order refund ever filed"
            />
          </div>

          <SectionCard contentClassName="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <RangeTabs value={status} onChange={setStatus} options={STATUS_OPTIONS} />
              <p className="text-[11px] text-slate-400">
                Only vendor-verified orders are refundable. Pending orders are cancelled by the
                student instead.
              </p>
            </div>

            {requests.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <Table className="min-w-[1020px]">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Reference</TableHead>
                      <TableHead>Student</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Reason</TableHead>
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
                          <p className="font-mono text-[11px] text-slate-700">
                            {request.orderReference ?? '—'}
                          </p>
                          <p className="max-w-[180px] truncate text-[10px] text-slate-400">
                            {request.vendorName ?? 'Vendor'}
                            {request.orderStatus ? ` • ${request.orderStatus.toLowerCase()}` : ''}
                          </p>
                        </TableCell>
                        <TableCell>
                          <p className="max-w-[220px] truncate text-[11px] text-slate-600">
                            {request.reason}
                          </p>
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
                              <Button type="button" size="sm" onClick={() => setReview(request)}>
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
                    ? 'Inbox zero — no order refunds waiting'
                    : 'No order refund requests here'
                }
                description={
                  status === 'PENDING'
                    ? 'Every order refund has been reviewed. New ones will appear here immediately.'
                    : 'When a student reports a problem with a verified order, the request lands in this queue.'
                }
                action={
                  status !== 'ALL' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setStatus('ALL')}
                    >
                      View all refunds
                    </Button>
                  ) : undefined
                }
              />
            )}
          </SectionCard>
        </>
      )}

      <OrderRefundReviewDialog
        refund={review}
        open={Boolean(review)}
        onOpenChange={(open) => {
          if (!open) setReview(null);
        }}
        onReviewed={reload}
      />

      <OrderRefundDetailDialog
        refund={detail}
        open={Boolean(detail)}
        onOpenChange={(open) => {
          if (!open) setDetail(null);
        }}
      />
    </div>
  );
}
