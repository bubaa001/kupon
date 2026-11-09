'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, RefreshCw, Trash2, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { Textarea } from '@/components/ui/textarea';
import { ApiClientError, apiFetch, deleteJson, patchJson } from '@/lib/client-api';
import { formatDateTime } from '@/lib/utils';
import { useAutoRefresh } from '@/lib/use-auto-refresh';

type VendorApplication = {
  id: string;
  name: string;
  code: string;
  description: string;
  businessRegistrationNumber: string;
  physicalAddress: string;
  registrationDocumentUrl: string;
  createdAt: string;
  applicationReviewedAt: string | null;
  applicationReviewNote: string | null;
  user: { name: string; email: string | null; phone: string };
  university: { name: string; code: string; city: string };
};

type VendorRequest = {
  id: string;
  ownerName: string;
  nidaNumber: string;
  email: string;
  phone: string;
  businessName: string;
  universityName: string;
  institutionPhone: string;
  tinDocumentKey: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewNote: string | null;
};

type UniversityOption = { id: string; name: string; code: string; city: string };
type ApplicationResponse = {
  applications: VendorApplication[];
  requests: VendorRequest[];
  rejectedApplications: VendorApplication[];
  rejectedRequests: VendorRequest[];
  universities: UniversityOption[];
};

export function VendorApplicationsView() {
  const [applications, setApplications] = useState<VendorApplication[]>([]);
  const [requests, setRequests] = useState<VendorRequest[]>([]);
  const [rejectedApplications, setRejectedApplications] = useState<VendorApplication[]>([]);
  const [rejectedRequests, setRejectedRequests] = useState<VendorRequest[]>([]);
  const [universities, setUniversities] = useState<UniversityOption[]>([]);
  const [verifiedIds, setVerifiedIds] = useState<Set<string>>(() => new Set());
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [assignedUniversities, setAssignedUniversities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollErrorShown = useRef(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<ApplicationResponse>('/api/super-admin/vendor-applications');
      setApplications(data.applications);
      setRequests(data.requests);
      setRejectedApplications(data.rejectedApplications);
      setRejectedRequests(data.rejectedRequests);
      setUniversities(data.universities);
      pollErrorShown.current = false;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Could not load applications.';
      setError(message);
      if (!silent || !pollErrorShown.current) toast.error(message);
      pollErrorShown.current = true;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useAutoRefresh(() => {
    void load(true);
  });

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

  async function decideRequest(application: VendorRequest, decision: 'APPROVE' | 'REJECT') {
    const note = notes[application.id]?.trim();
    setBusy(application.id);
    try {
      const result = await patchJson<{ message: string }>(
        `/api/super-admin/vendor-requests/${encodeURIComponent(application.id)}`,
        {
          decision,
          universityId: assignedUniversities[application.id] || undefined,
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

  async function reopenRejected(id: string, type: 'application' | 'request') {
    setBusy(id);
    try {
      const url =
        type === 'application'
          ? `/api/super-admin/vendor-applications/${encodeURIComponent(id)}`
          : `/api/super-admin/vendor-requests/${encodeURIComponent(id)}`;
      const result = await patchJson<{ message: string }>(url, { decision: 'REOPEN' });
      toast.success(result.message);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.message : 'Could not reopen this application.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function deleteRejected(id: string, type: 'application' | 'request') {
    if (
      !window.confirm(
        'Permanently delete this rejected record? This cannot be undone. Accounts with operational history cannot be deleted.',
      )
    ) {
      return;
    }

    setBusy(id);
    try {
      const url =
        type === 'application'
          ? `/api/super-admin/vendor-applications/${encodeURIComponent(id)}`
          : `/api/super-admin/vendor-requests/${encodeURIComponent(id)}`;
      const result = await deleteJson<{ message: string }>(url);
      toast.success(result.message);
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.message : 'Could not delete this application.',
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
        description="The Platform Admin provisions institutions, reviews business documents, and verifies each cafeteria before approval."
        actions={
          <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            Refresh
          </Button>
        }
      />

      {error ? <Alert variant="danger" title="Could not load applications">{error}</Alert> : null}
      {loading &&
      applications.length === 0 &&
      requests.length === 0 &&
      rejectedApplications.length === 0 &&
      rejectedRequests.length === 0 ? (
        <Card className="p-5 text-sm text-slate-500">Loading applications…</Card>
      ) : (
        <div className="space-y-6">
          {requests.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                New applications · apply first, Google after approval
              </h2>
              {requests.map((application) => {
                const documentsComplete = Boolean(
                  /^\d{20}$/.test(application.nidaNumber) &&
                    application.tinDocumentKey &&
                    /^\+255[67]\d{8}$/.test(application.phone) &&
                    /^\+255\d{9}$/.test(application.institutionPhone),
                );
                return (
                  <Card key={application.id} className="space-y-4 p-4 sm:p-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="warning">Needs review</Badge>
                      <Badge variant="neutral">
                        Institution: {application.universityName}
                      </Badge>
                      <span className="text-[11px] text-slate-400">
                        Submitted {formatDateTime(application.createdAt)}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">
                        {application.businessName}
                      </h3>
                      <div className="mt-2 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
                        <p>Owner: {application.ownerName}</p>
                        <p>Owner phone: {application.phone}</p>
                        <p>Owner NIDA: {application.nidaNumber || 'Missing'}</p>
                        <p>Google email: {application.email}</p>
                        <p>Institution phone: {application.institutionPhone || 'Missing'}</p>
                      </div>
                    </div>
                    {application.tinDocumentKey ? (
                      <a
                        href={`/api/super-admin/vendor-requests/${encodeURIComponent(application.id)}/tin-document`}
                        className="inline-flex text-xs font-semibold text-primary-700 underline-offset-2 hover:underline"
                      >
                        Download TIN/TRA document
                      </a>
                    ) : null}
                    {!application.tinDocumentKey ? (
                      <Alert variant="warning">
                        This application has no TIN/TRA document uploaded.
                      </Alert>
                    ) : null}
                    <div className="space-y-1.5">
                      <label
                        htmlFor={`campus-${application.id}`}
                        className="text-xs font-semibold text-slate-700"
                      >
                        Kupon campus
                      </label>
                      <select
                        id={`campus-${application.id}`}
                        value={assignedUniversities[application.id] ?? ''}
                        onChange={(event) =>
                          setAssignedUniversities((current) => ({
                            ...current,
                            [application.id]: event.target.value,
                          }))
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800"
                      >
                        <option value="">Select the verified campus</option>
                        {universities.map((university) => (
                          <option key={university.id} value={university.id}>
                            {university.name} · {university.city}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-amber-700">
                        The Kupon Platform Admin creates institutions. If this campus is not
                        listed, add it in{' '}
                        <Link
                          href="/super-admin/tenants"
                          className="font-semibold underline underline-offset-2"
                        >
                          university management
                        </Link>{' '}
                        before approving the application.
                      </p>
                    </div>
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
                    <Textarea
                      value={notes[application.id] ?? ''}
                      onChange={(event) =>
                        setNotes((current) => ({ ...current, [application.id]: event.target.value }))
                      }
                      placeholder="Review note or corrections for the applicant (required to reject)"
                      maxLength={500}
                      aria-label={`Review note for ${application.businessName}`}
                    />
                    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={busy === application.id || (notes[application.id]?.trim().length ?? 0) < 5}
                        onClick={() => void decideRequest(application, 'REJECT')}
                      >
                        <X className="h-4 w-4" />
                        Return for changes
                      </Button>
                      <Button
                        type="button"
                        disabled={
                          busy === application.id ||
                          !assignedUniversities[application.id] ||
                          !verifiedIds.has(application.id) ||
                          !documentsComplete
                        }
                        onClick={() => void decideRequest(application, 'APPROVE')}
                      >
                        <Check className="h-4 w-4" />
                        Approve and enable Google sign-in
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </section>
          ) : null}

          {applications.length ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">Existing vendor accounts</h2>
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
          ) : null}
          {!requests.length && !applications.length ? (
            <Card className="p-5 text-sm text-slate-500">
              {loading ? 'Refreshing…' : 'No cafeteria applications need review.'}
            </Card>
          ) : null}

          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">
                Rejected applications ({rejectedRequests.length + rejectedApplications.length})
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Reopen an application to review it again. Permanent deletion removes the application or vendor account; accounts with operational records are protected.
              </p>
            </div>
            {!rejectedRequests.length && !rejectedApplications.length ? (
              <Card className="p-4 text-sm text-slate-500">No rejected applications.</Card>
            ) : null}
            {rejectedRequests.map((application) => {
              const subject = `Kupon application review: ${application.businessName}`;
              const body = `Hello ${application.ownerName},\n\nRegarding your Kupon application for ${application.businessName}:\n\n${application.reviewNote ?? 'Please contact Kupon for details.'}\n\nYou may submit a new application after addressing the feedback.`;
              return (
                <Card key={application.id} className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="danger">Rejected</Badge>
                    <Badge variant="neutral">Institution: {application.universityName}</Badge>
                    <span className="text-[11px] text-slate-400">
                      Reviewed {application.reviewedAt ? formatDateTime(application.reviewedAt) : '—'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">
                      {application.businessName}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Owner: {application.ownerName} · {application.phone}
                    </p>
                    <a
                      href={`mailto:${application.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                      className="mt-1 inline-flex text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
                    >
                      {application.email}
                    </a>
                  </div>
                  <Alert variant="warning" title="Feedback saved (not emailed)">
                    {application.reviewNote || 'No review note was saved.'}
                  </Alert>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy === application.id}
                      onClick={() => void deleteRejected(application.id, 'request')}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete permanently
                    </Button>
                    <Button
                      type="button"
                      disabled={busy === application.id}
                      onClick={() => void reopenRejected(application.id, 'request')}
                    >
                      <Undo2 className="h-4 w-4" />
                      Reopen for review
                    </Button>
                  </div>
                </Card>
              );
            })}
            {rejectedApplications.map((application) => {
              const subject = `Kupon application review: ${application.name}`;
              const body = `Hello ${application.user.name},\n\nRegarding your Kupon application for ${application.name}:\n\n${application.applicationReviewNote ?? 'Please contact Kupon for details.'}`;
              return (
                <Card key={application.id} className="space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold">{application.code}</span>
                    <Badge variant="danger">Changes requested</Badge>
                    <Badge variant="neutral">
                      {application.university.name} · {application.university.city}
                    </Badge>
                    <span className="text-[11px] text-slate-400">
                      Reviewed{' '}
                      {application.applicationReviewedAt
                        ? formatDateTime(application.applicationReviewedAt)
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{application.name}</h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Owner: {application.user.name} · {application.user.phone}
                    </p>
                    {application.user.email ? (
                      <a
                        href={`mailto:${application.user.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}
                        className="mt-1 inline-flex text-sm font-medium text-primary-700 underline-offset-2 hover:underline"
                      >
                        {application.user.email}
                      </a>
                    ) : null}
                  </div>
                  <Alert variant="warning" title="Feedback saved (not emailed)">
                    {application.applicationReviewNote || 'No review note was saved.'}
                  </Alert>
                  <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy === application.id}
                      onClick={() => void deleteRejected(application.id, 'application')}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete permanently
                    </Button>
                    <Button
                      type="button"
                      disabled={busy === application.id}
                      onClick={() => void reopenRejected(application.id, 'application')}
                    >
                      <Undo2 className="h-4 w-4" />
                      Reopen for review
                    </Button>
                  </div>
                </Card>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}
