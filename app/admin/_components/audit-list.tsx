'use client';

import { ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { formatDateTime, relativeTime } from '@/lib/utils';
import type { AuditEntry } from './types';
import { actionLabel, actionTone, auditSummary } from './format';

export function AuditList({
  entries,
  emptyDescription = 'Money-moving admin actions will appear here as they happen.',
}: {
  entries: AuditEntry[];
  emptyDescription?: string;
}) {
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="No audit activity yet"
        description={emptyDescription}
        compact
        className="border-0 bg-transparent"
      />
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {entries.map((entry) => {
        const summary = auditSummary(entry.metadata ?? {});
        return (
          <li key={entry.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-xs font-semibold text-slate-800">{actionLabel(entry.action)}</p>
                <Badge variant={actionTone(entry.action)} className="text-[10px]">
                  {entry.entity ?? 'Audit'}
                </Badge>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                {entry.actor}
                {entry.actorRole ? ` • ${entry.actorRole.replace('_', ' ').toLowerCase()}` : ''} •{' '}
                {relativeTime(entry.createdAt)}
              </p>
              {summary ? (
                <p className="mt-1 break-words text-[11px] leading-relaxed text-slate-500">
                  {summary}
                </p>
              ) : null}
            </div>
            <time className="hidden shrink-0 text-[10px] text-slate-400 sm:block">
              {formatDateTime(entry.createdAt)}
            </time>
          </li>
        );
      })}
    </ul>
  );
}
