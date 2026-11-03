'use client';

import { useState } from 'react';
import { Check, Copy, ReceiptText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDateTime, formatTZS } from '@/lib/utils';
import type { TxRow } from './types';
import { DetailRow, MiniStat } from './ui-bits';

export function TransactionDetailDialog({
  row,
  open,
  onOpenChange,
}: {
  row: TxRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copyReference() {
    if (!row) return;
    try {
      await navigator.clipboard.writeText(row.reference);
      setCopied(true);
      toast.success('Reference copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy the reference on this browser.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        {row ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <span className="font-mono text-sm">{row.reference}</span>
              </DialogTitle>
              <DialogDescription>
                {formatDateTime(row.createdAt)} • {row.channel}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Amount
                </p>
                <p className="mt-1 text-xl font-semibold tabular tracking-tight text-slate-900">
                  {formatTZS(row.amount)}
                </p>
                <p className="mt-0.5 text-[11px] text-slate-500">{row.typeLabel}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={row.status} />
                <p className="mt-2 text-[10px] text-slate-400">
                  {row.settledAt ? `Settled ${formatDateTime(row.settledAt)}` : 'Not settled yet'}
                </p>
              </div>
            </div>

            <div className="grid gap-x-6 sm:grid-cols-2">
              <DetailRow label="Student">{row.student.name}</DetailRow>
              <DetailRow label="Student ID">{row.student.studentId}</DetailRow>
              <DetailRow label="Student phone">{row.student.phone}</DetailRow>
              <DetailRow label="Vendor">
                {row.vendor ? `${row.vendor.name} (${row.vendor.code})` : 'Kupon wallet'}
              </DetailRow>
              <DetailRow label="Lipa Namba">{row.routeCode ?? '—'}</DetailRow>
              <DetailRow label="Details">{row.metadataSummary ?? '—'}</DetailRow>
            </div>

            {row.type === 'PAYMENT' && row.status === 'SETTLED' ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <MiniStat label="Platform fee" value={formatTZS(row.platformFee)} />
                <MiniStat label="University share" value={formatTZS(row.universityRevenue)} />
                <MiniStat label="Vendor payout" value={formatTZS(row.vendorSettlement)} />
                <MiniStat label="Aggregator" value={formatTZS(row.aggregatorFee)} />
              </div>
            ) : null}

            {row.failureReason ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-semibold">Failure reason</p>
                <p className="mt-1 leading-relaxed">{row.failureReason}</p>
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void copyReference()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied' : 'Copy reference'}
              </Button>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </>
        ) : (
          <DialogHeader>
            <DialogTitle>Transaction</DialogTitle>
            <DialogDescription>Select a transaction to see its details.</DialogDescription>
          </DialogHeader>
        )}
      </DialogContent>
    </Dialog>
  );
}
