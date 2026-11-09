'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ApiClientError, apiFetch, patchJson } from '@/lib/client-api';
import { formatDateTime, formatTZS } from '@/lib/utils';

type CreditRequest = {
  id: string;
  reference: string;
  kind: string;
  status: string;
  amount: number;
  reason: string;
  vendorNote: string | null;
  adminNote: string | null;
  createdAt: string;
  order: { reference: string; status: string; expiresAt: string };
  student: { studentId: string; user: { name: string } };
  vendor: { name: string; code: string };
  university: { name: string; code: string };
  reviewer: { name: string; role: string } | null;
};

type CreditRequestsResponse = { requests: CreditRequest[] };

export function CreditRequestsView() {
  const [data, setData] = useState<CreditRequestsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<CreditRequestsResponse>('/api/super-admin/credit-requests'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load credit requests.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(requestId: string, decision: 'APPROVE' | 'REJECT') {
    const note = window.prompt(`Platform-admin note for ${requestId}:`, '');
    if (note === null) return;
    if (note.trim().length < 5) {
      toast.error('Enter a review note with at least 5 characters.');
      return;
    }
    setBusy(requestId);
    try {
      await patchJson(`/api/super-admin/credit-requests/${encodeURIComponent(requestId)}`, {
        decision,
        note,
      });
      toast.success(
        decision === 'APPROVE'
          ? 'Student credit issued to the cafeteria account.'
          : 'Credit request rejected.',
      );
      await load();
    } catch (error) {
      toast.error(error instanceof ApiClientError ? error.message : 'Could not review the request.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform operations"
        title="Cafeteria credit requests"
        description="Review credit cases and see Finance decisions across cafeterias. Finance can issue cafeteria-specific credit; every reason remains visible here."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      <Alert variant="info">
        Student credit is restricted to the originating cafeteria and is not cash or a general wallet. Finance-issued credit decisions and notes are recorded here for platform oversight.
      </Alert>

      {loading && !data ? (
        <Card className="p-5 text-sm text-slate-500">Loading requests…</Card>
      ) : data?.requests.length ? (
        <section className="space-y-3">
          {data.requests.map((request) => (
            <Card key={request.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{request.reference}</span>
                    <Badge
                      variant={
                        request.status === 'PENDING_ADMIN'
                          ? 'warning'
                          : request.status === 'APPROVED'
                            ? 'success'
                            : request.status === 'REJECTED'
                              ? 'danger'
                              : 'neutral'
                      }
                    >
                      {request.status.replaceAll('_', ' ')}
                    </Badge>
                    <Badge variant="neutral">{request.kind.replaceAll('_', ' ')}</Badge>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatTZS(request.amount)} · {request.vendor.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.student.user.name} ({request.student.studentId}) · {request.university.name}
                    {' · '}Order {request.order.reference}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">{request.reason}</p>
                  {request.vendorNote || request.adminNote ? (
                    <div className="mt-2 space-y-1 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      {request.vendorNote ? <p>Cafeteria note: {request.vendorNote}</p> : null}
                      {request.adminNote ? <p>Finance/review note: {request.adminNote}</p> : null}
                    </div>
                  ) : null}
                  {request.reviewer ? (
                    <p className="mt-1 text-[11px] text-slate-400">
                      Reviewed by {request.reviewer.name} ({request.reviewer.role})
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
                {request.status === 'PENDING_ADMIN' ? <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    disabled={busy === request.id}
                    onClick={() => void decide(request.id, 'APPROVE')}
                  >
                    <Check className="h-4 w-4" />
                    Issue credit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy === request.id}
                    onClick={() => void decide(request.id, 'REJECT')}
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </Button>
                </div> : null}
              </div>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="p-5 text-sm text-slate-500">
          {loading ? 'Refreshing…' : 'No cafeteria credit requests need review.'}
        </Card>
      )}
    </div>
  );
}
