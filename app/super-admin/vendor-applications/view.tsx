'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiFetch, patchJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';

type VendorApplication = {
  id: string;
  name: string;
  code: string;
  description: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  registrationDocumentUrl: string;
  createdAt: string;
  user: { name: string; email: string | null; phone: string };
  university: { name: string; code: string; city: string };
};

type ApplicationResponse = { applications: VendorApplication[] };

export function VendorApplicationsView() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ApplicationResponse>('/api/super-admin/vendor-applications');
      setApplications(data.applications);
      setVerifiedIds(new Set());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load applications.';
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function decide(application: VendorApplication, decision: 'APPROVE' | 'REJECT') {
    const note = notes[application.id]?.trim();
    setBusy(application.id);
    try {
      const result = await patchJson<{ message: string }>(
        `/api/super-admin/vendor-applications/${encodeURIComponent(application.id)}`,
        {
          decision,
          physicalSiteVerified: verifiedIds.has(application.id),
          note: note || undefined,
        },
      );
      toast.success(result.message);
      setNotes((current) => {
        const next = { ...current };
        delete next[application.id];
        return next;
      });
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.message : 'Could not review this application.',
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform operations"
        title="Cafeteria applications"
        description="Review business documents and confirm each cafeteria physically exists before approval."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      {error ? <Alert variant="danger" title="Could not load applications">{error}</Alert> : null}
      {loading && applications.length === 0 ? (
        <Card className="p-5 text-sm text-slate-500">Loading applications…</Card>
      ) : applications.length ? (
        <section className="space-y-3">
          {applications.map((application) => {
            const documentsComplete = Boolean(
              application.businessRegistrationNumber &&
                application.physicalAddress &&
                application.registrationDocumentUrl.startsWith('https://'),
            );
            return (
              <Card key={application.id} className="space-y-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold">{application.code}</span>
                  <Badge variant="warning">Needs review</Badge>
                  <Badge variant="neutral">
                    {application.university.name} · {application.university.city}
                  </Badge>
                  <span className="text-[11px] text-slate-400">
                    Submitted {formatDateTime(application.createdAt)}
                  </span>
                </div>

                <div>
                  <h2 className="text-base font-semibold text-slate-900">{application.name}</h2>
                  <p className="mt-1 text-sm text-slate-600">{application.description}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Owner: {application.user.name} · {application.user.phone}
                    {application.user.email ? ` · ${application.user.email}` : ''}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Business registration
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {application.businessRegistrationNumber || 'Missing'}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Physical cafeteria location
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      {application.physicalAddress || 'Missing'}
                    </p>
                  </div>
                </div>

                {application.registrationDocumentUrl.startsWith('https://') ? (
                  <a
                    href={application.registrationDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex text-xs font-semibold text-primary-700 underline-offset-2 hover:underline"
                  >
                    Open registration document
                  </a>
                ) : (
                  <Alert variant="warning">This application has no secure registration document link.</Alert>
                )}

                <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 p-3 text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={verifiedIds.has(application.id)}
                    onChange={(event) =>
                      setVerifiedIds((current) => {
                        const next = new Set(current);
                        if (event.target.checked) next.add(application.id);
                        else next.delete(application.id);
                        return next;
                      })
                    }
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-primary-600"
                  />
                  I verified this cafeteria physically exists at the submitted location.
                </label>

                <div className="space-y-2">
                  <Textarea
                    value={notes[application.id] ?? ''}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [application.id]: event.target.value }))
                    }
                    placeholder="Review note or corrections for the applicant (required to reject)"
                    maxLength={500}
                    aria-label={`Review note for ${application.name}`}
                  />
                  {!documentsComplete ? (
                    <p className="text-xs text-amber-700">Complete documents and location details before approving.</p>
                  ) : null}
                </div>

                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busy === application.id || (notes[application.id]?.trim().length ?? 0) < 5}
                    onClick={() => void decide(application, 'REJECT')}
                  >
                    <X className="h-4 w-4" />
                    Return for changes
                  </Button>
                  <Button
                    type="button"
                    disabled={
                      busy === application.id ||
                      !verifiedIds.has(application.id) ||
                      !documentsComplete
                    }
                    onClick={() => void decide(application, 'APPROVE')}
                  >
                    <Check className="h-4 w-4" />
                    Approve cafeteria
                  </Button>
                </div>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="p-5 text-sm text-slate-500">
          {loading ? 'Refreshing…' : 'No cafeteria applications need review.'}
        </Card>
      )}
    </div>
  );
}
