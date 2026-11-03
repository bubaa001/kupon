'use client';

import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/ui/money';
import { StatusBadge } from '@/components/ui/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, relativeTime } from '@/lib/utils';
import type { TxRow } from './types';

export function TransactionTable({
  rows,
  dense = false,
  onSelect,
}: {
  rows: TxRow[];
  dense?: boolean;
  onSelect?: (row: TxRow) => void;
}) {
  return (
    <Table className="min-w-[720px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Reference</TableHead>
          <TableHead>Student</TableHead>
          <TableHead className="hidden md:table-cell">Vendor</TableHead>
          <TableHead className="hidden lg:table-cell">Channel</TableHead>
          <TableHead>Type</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Status</TableHead>
          {onSelect ? <TableHead className="w-6" /> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={onSelect ? () => onSelect(row) : undefined}
            className={cn(onSelect && 'cursor-pointer')}
          >
            <TableCell className={dense ? 'py-2.5' : undefined}>
              <p className="font-mono text-[11px] font-semibold tracking-tight text-slate-800">
                {row.reference}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-400">{relativeTime(row.createdAt)}</p>
            </TableCell>
            <TableCell className={dense ? 'py-2.5' : undefined}>
              <p className="truncate text-xs font-medium text-slate-800">{row.student.name}</p>
              <p className="truncate text-[10px] text-slate-400">{row.student.studentId}</p>
            </TableCell>
            <TableCell className={cn('hidden md:table-cell', dense && 'py-2.5')}>
              {row.vendor ? (
                <>
                  <p className="truncate text-xs font-medium text-slate-800">{row.vendor.name}</p>
                  <p className="truncate font-mono text-[10px] text-slate-400">{row.vendor.code}</p>
                </>
              ) : (
                <span className="text-[11px] text-slate-400">Wallet</span>
              )}
            </TableCell>
            <TableCell className={cn('hidden lg:table-cell', dense && 'py-2.5')}>
              <span className="text-[11px] text-slate-600">{row.channel}</span>
            </TableCell>
            <TableCell className={dense ? 'py-2.5' : undefined}>
              <Badge variant="outline" className="whitespace-nowrap text-[10px]">
                {row.typeLabel}
              </Badge>
            </TableCell>
            <TableCell className={cn('text-right', dense && 'py-2.5')}>
              <Money amount={row.amount} className="text-xs" />
            </TableCell>
            <TableCell className={dense ? 'py-2.5' : undefined}>
              <StatusBadge status={row.status} />
            </TableCell>
            {onSelect ? (
              <TableCell className={dense ? 'py-2.5' : undefined}>
                <ChevronRight className="h-4 w-4 text-slate-300" />
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
