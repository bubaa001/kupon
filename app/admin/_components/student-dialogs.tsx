'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Link2, Mail, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { RefundStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApiClientError, postJson } from '@/lib/client-api';
import { formatDate, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import type { StudentDetailData } from './types';
import { useApiData } from './hooks';
import { AuditList } from './audit-list';
import { DataTableSkeleton, DetailRow, MiniStat } from './ui-bits';
import { TransactionTable } from './transaction-table';

export function StudentDetailDialog({
  studentId,
  open,
  onOpenChange,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const url = open && studentId ? `/api/admin/students/${studentId}` : null;
  const { data, error, loading, reload } = useApiData<StudentDetailData>(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Student account</DialogTitle>
          <DialogDescription>
            Account, order history and audit trail for this student.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <Alert variant="danger">{error}</Alert>
        ) : loading || !data ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 animate-pulse rounded-full bg-slate-200" />
              <div className="space-y-2">
                <div className="h-4 w-40 animate-pulse rounded bg-slate-200" />
                <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
            <DataTableSkeleton rows={5} columns={4} />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 items-center gap-3">
                <Avatar name={data.student.name} size="lg" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {data.student.name}
                  </p>
                  <p className="truncate font-mono text-[11px] text-slate-500">
                    {data.student.studentId}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <Badge variant="neutral" className="text-[10px]">
                      {data.student.course} • Year {data.student.year}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {data.student.university.code}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="refunds">Legacy refunds</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MiniStat label="Order payments" value={formatTZS(data.stats.totalSpent)} />
                  <MiniStat label="Transactions" value={String(data.stats.transactionCount)} />
                  <MiniStat
                    label="Last activity"
                    value={
                      data.stats.lastActivityAt ? relativeTime(data.stats.lastActivityAt) : '—'
                    }
                  />
                </div>
                <div className="grid gap-x-6 sm:grid-cols-2">
                  <DetailRow label="Phone">{data.student.phone}</DetailRow>
                  <DetailRow label="Course">{data.student.course}</DetailRow>
                  <DetailRow label="Year of study">{data.student.year}</DetailRow>
                  <DetailRow label="University">
                    {data.student.university.name}
                  </DetailRow>
                  <DetailRow label="Lipa Namba">
                    <span className="font-mono">{data.student.university.paymentRouteCode}</span>
                  </DetailRow>
                  <DetailRow label="Joined">{formatDate(data.student.joinedAt)}</DetailRow>
                  <DetailRow label="Last login">
                    {data.student.lastLoginAt ? formatDateTime(data.student.lastLoginAt) : 'Never'}
                  </DetailRow>
                </div>

                <GoogleSignInCard
                  studentId={data.student.id}
                  email={data.student.email}
                  googleLinked={data.student.googleLinked}
                  onUpdated={reload}
                />
              </TabsContent>

              <TabsContent value="activity">
                {data.transactions.length > 0 ? (
                  <div className="space-y-2">
                    <div className="-mx-1 overflow-x-auto rounded-xl border border-slate-200">
                      <TransactionTable rows={data.transactions} dense />
                    </div>
                    <p className="px-1 text-[11px] text-slate-400">
                      Showing the {data.transactions.length} most recent of{' '}
                      {data.stats.transactionCount} transactions.
                    </p>
                  </div>
                ) : (
                  <EmptyState
                    icon={ArrowDownLeft}
                    title="No transactions yet"
                    description="This student has not paid for a meal yet."
                    compact
                  />
                )}
              </TabsContent>

              <TabsContent value="refunds">
                {data.refunds.length > 0 ? (
                  <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-3">
                    {data.refunds.map((refund) => (
                      <li key={refund.id} className="py-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-800">
                              {formatTZS(refund.amount)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-400">
                              {refund.reference}
                            </span>
                          </div>
                          <RefundStatusBadge status={refund.status} />
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                          {refund.reason}
                        </p>
                        {refund.adminNote ? (
                          <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1.5 text-[11px] text-slate-500">
                            {refund.reviewedBy ?? 'Admin'}: {refund.adminNote}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-slate-400">
                          Requested {relativeTime(refund.createdAt)}
                          {refund.reviewedAt ? ` • Reviewed ${relativeTime(refund.reviewedAt)}` : ''}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={ArrowUpRight}
                    title="No legacy refund records"
                    description="Current cafeteria issues use the credit-request flow instead."
                    compact
                  />
                )}
              </TabsContent>

              <TabsContent value="audit">
                <AuditList
                  entries={data.audit}
                  emptyDescription="Account and access events for this student are recorded here."
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Admin-side Google fallback management. The admin sets the student's verified
 * Google email; the first successful Google OAuth proves ownership and binds
 * googleId. This is the recovery path for a student who cannot receive SMS.
 */
function GoogleSignInCard({
  studentId,
  email,
  googleLinked,
  onUpdated,
}: {
  studentId: string;
  email: string | null;
  googleLinked: boolean;
  onUpdated: () => void;
}) {
  const [value, setValue] = useState(email ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValue(email ?? '');
  }, [email]);

  const trimmed = value.trim().toLowerCase();
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  const changed = trimmed !== (email ?? '').toLowerCase();

  async function save(nextEmail: string | null) {
    setSaving(true);
    setError(null);
    try {
      const result = await postJson<{ message: string }>(
        `/api/admin/students/${studentId}/google-link`,
        { email: nextEmail },
      );
      toast.success(nextEmail ? 'Google email linked' : 'Google email removed', {
        description: result.message,
      });
      onUpdated();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : 'Could not update the Google fallback.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <Mail className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-900">Google sign-in fallback</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">
              Use this when the student cannot receive SMS OTPs. The email must belong to their
              Google account.
            </p>
          </div>
        </div>
        {googleLinked ? (
          <Badge variant="success" dot>
            Connected
          </Badge>
        ) : email ? (
          <Badge variant="warning" dot>
            Email ready
          </Badge>
        ) : (
          <Badge variant="neutral" dot>
            Not linked
          </Badge>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          inputMode="email"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="student@example.com"
          aria-label="Student Google email"
          error={Boolean(error)}
        />
        <Button
          type="button"
          loading={saving}
          disabled={!valid || !changed}
          onClick={() => void save(trimmed)}
          className="shrink-0"
        >
          <Link2 className="h-4 w-4" />
          {email ? 'Update email' : 'Link email'}
        </Button>
        {email ? (
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => void save(null)}
            className="shrink-0"
          >
            <Unlink className="h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      ) : null}
      <p className="mt-2 text-[10px] text-slate-400">
        {googleLinked
          ? 'Google OAuth is active for this student. Changing the email removes the existing Google binding.'
          : email
            ? 'Email pre-linked. The student should now choose “Continue with Google” on the login page.'
            : 'No Google account linked yet. OTP remains available.'}
      </p>
    </div>
  );
}
