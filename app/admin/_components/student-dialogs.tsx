'use client';

import { useEffect, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Link2, Mail, Unlink, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Money } from '@/components/ui/money';
import { RefundStatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, postJson } from '@/lib/client-api';
import { cn, formatDate, formatDateTime, formatTZS, relativeTime } from '@/lib/utils';
import type { StudentDetailData } from './types';
import { useApiData } from './hooks';
import { AuditList } from './audit-list';
import { DataTableSkeleton, DetailRow, MiniStat } from './ui-bits';
import { TransactionTable } from './transaction-table';

export type AdjustTarget = {
  id: string;
  name: string;
  studentId: string;
  balance: number;
};

export function StudentDetailDialog({
  studentId,
  open,
  onOpenChange,
  onAdjust,
}: {
  studentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdjust: (student: AdjustTarget) => void;
}) {
  const url = open && studentId ? `/api/admin/students/${studentId}` : null;
  const { data, error, loading, reload } = useApiData<StudentDetailData>(url);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Student wallet</DialogTitle>
          <DialogDescription>
            Full wallet history, refunds and the audit trail for this student.
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
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
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
              <div className="flex items-end justify-between gap-3 sm:flex-col sm:items-end">
                <div className="sm:text-right">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Wallet balance
                  </p>
                  <Money amount={data.student.balance} className="text-lg" />
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onAdjust({
                      id: data.student.id,
                      name: data.student.name,
                      studentId: data.student.studentId,
                      balance: data.student.balance,
                    });
                  }}
                >
                  <Wallet className="h-4 w-4" />
                  Adjust wallet
                </Button>
              </div>
            </div>

            <Tabs defaultValue="overview">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
                <TabsTrigger value="refunds">Refunds</TabsTrigger>
                <TabsTrigger value="audit">Audit</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <MiniStat
                    label="Total top-ups"
                    value={formatTZS(data.stats.totalTopUps)}
                    tone="emerald"
                  />
                  <MiniStat label="Total spent" value={formatTZS(data.stats.totalSpent)} />
                  <MiniStat label="Refunded" value={formatTZS(data.stats.totalRefunded)} />
                  <MiniStat
                    label="Manual adjustments"
                    value={formatTZS(data.stats.adjustments)}
                    tone={data.stats.adjustments < 0 ? 'red' : 'neutral'}
                  />
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
                    description="This student has not topped up or paid for a meal yet."
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
                    title="No refund requests"
                    description="This student has not asked for a refund of unused balance."
                    compact
                  />
                )}
              </TabsContent>

              <TabsContent value="audit">
                <AuditList
                  entries={data.audit}
                  emptyDescription="Manual wallet adjustments for this student are recorded here."
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 50000];

export function AdjustWalletDialog({
  target,
  open,
  onOpenChange,
  onDone,
}: {
  target: AdjustTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [type, setType] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setType('CREDIT');
      setAmount('');
      setReason('');
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  const amountNumber = Number(amount);
  const validAmount =
    Number.isFinite(amountNumber) && amountNumber >= 100 && amountNumber <= 500_000;
  const overBalance =
    type === 'DEBIT' && target ? validAmount && amountNumber > target.balance : false;

  async function submit() {
    if (!target) return;
    if (!validAmount) {
      setError('Enter an amount between TZS 100 and TZS 500,000.');
      return;
    }
    if (reason.trim().length < 5) {
      setError('Add a short reason — it is written to the audit log.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = await postJson<{ balance: number; reference: string; message: string }>(
        `/api/admin/students/${target.id}/adjust`,
        { type, amount: Math.round(amountNumber), reason: reason.trim() },
      );
      toast.success(data.message, { description: `Reference ${data.reference}` });
      onDone();
      onOpenChange(false);
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'The adjustment could not be saved.';
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <span className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
            <Wallet className="h-5 w-5" />
          </span>
          <DialogTitle>Manual wallet adjustment</DialogTitle>
          <DialogDescription>
            {target ? (
              <>
                <span className="font-medium text-slate-700">{target.name}</span> •{' '}
                <span className="font-mono text-[11px]">{target.studentId}</span> • balance{' '}
                <span className="font-semibold text-slate-700">{formatTZS(target.balance)}</span>
              </>
            ) : (
              'Select a student first.'
            )}
          </DialogDescription>
        </DialogHeader>

        {error ? <Alert variant="danger">{error}</Alert> : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('CREDIT')}
            className={cn(
              'flex items-center gap-2 rounded-xl border p-3 text-left transition-colors',
              type === 'CREDIT'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            <ArrowDownLeft className="h-4 w-4" />
            <span>
              <span className="block text-xs font-semibold">Credit</span>
              <span className="text-[10px] opacity-80">Top the wallet up</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setType('DEBIT')}
            className={cn(
              'flex items-center gap-2 rounded-xl border p-3 text-left transition-colors',
              type === 'DEBIT'
                ? 'border-red-300 bg-red-50 text-red-700'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300',
            )}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>
              <span className="block text-xs font-semibold">Debit</span>
              <span className="text-[10px] opacity-80">Recover / correct funds</span>
            </span>
          </button>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adjust-amount">Amount (TZS)</Label>
          <Input
            id="adjust-amount"
            type="number"
            inputMode="numeric"
            min={100}
            max={500_000}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="5000"
            className="tabular"
          />
          <div className="flex flex-wrap gap-1.5 pt-1">
            {QUICK_AMOUNTS.map((quick) => (
              <button
                key={quick}
                type="button"
                onClick={() => setAmount(String(quick))}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-primary-300 hover:text-primary-700"
              >
                {type === 'CREDIT' ? '+' : ''}
                {quick.toLocaleString('en-US')}
              </button>
            ))}
          </div>
          {overBalance ? (
            <p className="text-[11px] font-medium text-amber-700">
              This debit is larger than the current wallet balance — the server will reject it.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adjust-reason">Reason for the audit log</Label>
          <Textarea
            id="adjust-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Cash top-up received at the finance office, receipt #4182"
            maxLength={300}
            className="min-h-[80px]"
          />
          <p className="text-right text-[10px] text-slate-400">{reason.length}/300</p>
        </div>

        <Alert variant="warning" title="This moves real ledger entries">
          The wallet balance, double-entry journal and an immutable audit entry are written in one
          transaction. It cannot be undone from the UI.
        </Alert>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" loading={submitting} onClick={() => void submit()}>
            {type === 'CREDIT' ? 'Credit wallet' : 'Debit wallet'}
          </Button>
        </DialogFooter>
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
          placeholder="student@gmail.com or student@udsm.ac.tz"
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
