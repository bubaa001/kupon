'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ScrollText, ShieldCheck, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ApiClientError, patchJson } from '@/lib/client-api';
import { cn, formatDate, formatTZS } from '@/lib/utils';
import type { AuditLogData, SettingsData } from '../_components/types';
import { useApiData } from '../_components/hooks';
import { AuditList } from '../_components/audit-list';
import { invoicePeriod } from '../_components/format';
import { DetailRow, SectionCard } from '../_components/ui-bits';

const BRAND_SWATCHES = ['#10B981', '#0EA5E9', '#6366F1', '#F59E0B', '#EF4444', '#0F172A'];

const ACCOUNT_LABELS: Record<string, string> = {
  STUDENT_WALLET: 'Legacy student balances (historical)',
  VENDOR_PENDING: 'Vendor pending settlement',
  PLATFORM_REVENUE: 'Kupon platform revenue',
  UNIVERSITY_REVENUE: 'University revenue',
  AGGREGATOR_PAYABLE: 'Aggregator payable',
  CASH_TRUST: 'Cash trust',
};

const INVOICE_BADGE: Record<
  string,
  { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  PAID: { label: 'Paid', variant: 'success' },
  PENDING: { label: 'Pending', variant: 'warning' },
  OVERDUE: { label: 'Overdue', variant: 'danger' },
};

export default function AdminSettingsPage() {
  const settings = useApiData<SettingsData>('/api/admin/settings');
  const audit = useApiData<AuditLogData>('/api/admin/audit?limit=20');

  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [brandColor, setBrandColor] = useState('#10B981');
  const [routeCode, setRouteCode] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingRoute, setSavingRoute] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);

  const university = settings.data?.university;

  useEffect(() => {
    if (!university) return;
    setName(university.name);
    setCity(university.city);
    setBrandColor(university.brandColor);
    setRouteCode(university.paymentRouteCode);
  }, [university]);

  const profileDirty = Boolean(
    university &&
      (name !== university.name || city !== university.city || brandColor !== university.brandColor),
  );
  const routeDirty = Boolean(university && routeCode !== university.paymentRouteCode);

  const paidTotal = useMemo(
    () =>
      (settings.data?.invoices ?? [])
        .filter((invoice) => invoice.status === 'PAID')
        .reduce((sum, invoice) => sum + invoice.amount, 0),
    [settings.data],
  );

  async function saveProfile() {
    if (name.trim().length < 4) {
      setProfileError('The university name needs at least 4 characters.');
      return;
    }
    if (city.trim().length < 2) {
      setProfileError('Add the city your campus is in.');
      return;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
      setProfileError('Brand colour must be a hex value like #10B981.');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const data = await patchJson<{ message: string }>('/api/admin/settings', {
        name: name.trim(),
        city: city.trim(),
        brandColor,
      });
      toast.success(data.message);
      settings.reload();
      audit.reload();
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'Could not save the profile.';
      setProfileError(message);
      toast.error(message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveRouteCode() {
    setSavingRoute(true);
    setRouteError(null);
    try {
      await patchJson('/api/admin/settings', {
        paymentRouteCode: routeCode.trim(),
      });
      toast.success('Payment routing code updated.', {
        description: 'The new code will be recorded with future checkout events.',
      });
      settings.reload();
      audit.reload();
    } catch (caught) {
      const message =
        caught instanceof ApiClientError ? caught.message : 'Could not save the Lipa Namba.';
      setRouteError(message);
      toast.error(message);
    } finally {
      setSavingRoute(false);
    }
  }

  if (settings.error) {
    return (
      <div className="space-y-5">
        <PageHeader title="Settings" description="Campus configuration and billing." />
        <Alert variant="danger" title="Could not load settings">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{settings.error}</span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                settings.reload();
                audit.reload();
              }}
            >
              Try again
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Campus configuration"
        title="Settings"
        description="University profile, mobile-money collection code, SaaS billing and ledger health."
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              settings.reload();
              audit.reload();
            }}
            disabled={settings.loading}
          >
            <RefreshCw className={settings.loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        }
      />

      {settings.loading && !settings.data ? (
        <PageSkeleton />
      ) : settings.data ? (
        <>
          <div className="grid min-w-0 gap-4 xl:grid-cols-3">
            <div className="min-w-0 space-y-4 xl:col-span-2">
              <SectionCard
                title="University profile"
                description="Shown to students, vendors and on every receipt."
                action={
                  profileDirty ? (
                    <Badge variant="warning" dot>
                      Unsaved
                    </Badge>
                  ) : null
                }
                contentClassName="space-y-4"
              >
                {profileError ? <Alert variant="danger">{profileError}</Alert> : null}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="university-name">University name</Label>
                    <Input
                      id="university-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={120}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="university-city">City</Label>
                    <Input
                      id="university-city"
                      value={city}
                      onChange={(event) => setCity(event.target.value)}
                      maxLength={60}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Brand colour</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {BRAND_SWATCHES.map((swatch) => (
                      <button
                        key={swatch}
                        type="button"
                        aria-label={`Use brand colour ${swatch}`}
                        aria-pressed={brandColor === swatch}
                        onClick={() => setBrandColor(swatch)}
                        className={cn(
                          'h-8 w-8 rounded-lg border-2 transition-transform hover:scale-105',
                          brandColor === swatch
                            ? 'border-slate-900 ring-2 ring-slate-300'
                            : 'border-white ring-1 ring-slate-200',
                        )}
                        style={{ backgroundColor: swatch }}
                      />
                    ))}
                    <Input
                      value={brandColor}
                      onChange={(event) => setBrandColor(event.target.value)}
                      className="ml-1 w-28 font-mono text-xs uppercase"
                      maxLength={7}
                      aria-label="Brand colour hex value"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-4">
                  <p className="text-[11px] text-slate-400">
                    Changes are audit-logged with before and after values.
                  </p>
                  <Button
                    type="button"
                    loading={savingProfile}
                    disabled={!profileDirty || !name.trim() || !city.trim()}
                    onClick={() => void saveProfile()}
                  >
                    Save profile
                  </Button>
                </div>
              </SectionCard>

              <SectionCard
                title="Checkout routing code"
                description="A university-specific code stored with checkout records. This test gateway does not collect money or create student balances."
                contentClassName="space-y-4"
              >
                {routeError ? <Alert variant="danger">{routeError}</Alert> : null}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="space-y-1.5 sm:w-64">
                    <Label htmlFor="route-code">Routing code</Label>
                    <Input
                      id="route-code"
                      value={routeCode}
                      onChange={(event) =>
                        setRouteCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      inputMode="numeric"
                      maxLength={6}
                      className="font-mono text-lg tracking-[0.3em]"
                    />
                  </div>
                  <div className="flex-1 text-[11px] leading-relaxed text-slate-500">
                    <p>
                      Current code{' '}
                      <span className="font-mono font-semibold text-slate-800">
                        {university?.paymentRouteCode}
                      </span>
                      . Changing it only affects new checkout records; historical payments keep
                      their original route code.
                    </p>
                  </div>
                  <Button
                    type="button"
                    loading={savingRoute}
                    disabled={!routeDirty || routeCode.length !== 6}
                    onClick={() => void saveRouteCode()}
                  >
                    Update code
                  </Button>
                </div>
              </SectionCard>

              <SectionCard
                title="SaaS billing"
                description={`Kupon platform subscription • ${formatTZS(university?.saasFee ?? 0)} per month.`}
                action={
                  <Badge variant="neutral">
                    {formatTZS(paidTotal)} paid lifetime
                  </Badge>
                }
                contentClassName="space-y-3"
              >
                {(settings.data.invoices ?? []).length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <Table className="min-w-[560px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Invoice</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Paid</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {settings.data.invoices.map((invoice) => {
                          const badge = INVOICE_BADGE[invoice.status] ?? {
                            label: invoice.status,
                            variant: 'neutral' as const,
                          };
                          return (
                            <TableRow key={invoice.id}>
                              <TableCell>
                                <p className="font-mono text-[11px] text-slate-700">
                                  {invoice.reference}
                                </p>
                                <p className="text-[10px] text-slate-400">
                                  Issued {formatDate(invoice.issuedAt)}
                                </p>
                              </TableCell>
                              <TableCell>
                                <span className="text-xs font-medium text-slate-700">
                                  {invoicePeriod(invoice.period)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className="text-xs font-semibold tabular text-slate-900">
                                  {formatTZS(invoice.amount)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={badge.variant} dot>
                                  {badge.label}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <span className="text-[11px] text-slate-500">
                                  {invoice.paidAt ? formatDate(invoice.paidAt) : '—'}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-4 py-8 text-center text-xs text-slate-500">
                    No SaaS invoices have been issued yet.
                  </div>
                )}
              </SectionCard>
            </div>

            <div className="min-w-0 space-y-4">
              <SectionCard title="Campus at a glance">
                <div className="mb-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: brandColor }}
                  >
                    {university?.code.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {university?.name}
                    </p>
                    <p className="font-mono text-[10px] text-slate-400">{university?.code}</p>
                  </div>
                  <Badge
                    variant={university?.status === 'ACTIVE' ? 'success' : 'danger'}
                    dot
                    className="ml-auto"
                  >
                    {university?.status === 'ACTIVE' ? 'Active' : 'Suspended'}
                  </Badge>
                </div>
                <DetailRow label="University code">{university?.code}</DetailRow>
                <DetailRow label="On Kupon since">
                  {university ? formatDate(university.createdAt) : '—'}
                </DetailRow>
                <DetailRow label="Monthly SaaS fee">
                  {formatTZS(university?.saasFee ?? 0)}
                </DetailRow>
                <DetailRow label="Billing cycle">
                  {settings.data.invoices.length > 0
                    ? invoicePeriod(settings.data.invoices[0].period)
                    : '—'}
                </DetailRow>
              </SectionCard>

              <SectionCard
                title="Ledger health"
                description="Every money movement writes a balanced double-entry journal."
                action={
                  <Badge
                    variant={settings.data.ledger.balanced ? 'success' : 'danger'}
                    dot
                  >
                    {settings.data.ledger.balanced ? 'Balanced' : 'Out of balance'}
                  </Badge>
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Total debits
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular text-slate-900">
                      {formatTZS(settings.data.ledger.debits)}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      Total credits
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular text-slate-900">
                      {formatTZS(settings.data.ledger.credits)}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {settings.data.ledger.entries.toLocaleString('en-US')} journal entries across
                  your campus.
                </p>
                <div className="mt-3 space-y-1.5">
                  {settings.data.ledger.accounts.map((account) => (
                    <div
                      key={account.account}
                      className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[11px] odd:bg-slate-50"
                    >
                      <span className="truncate text-slate-600">
                        {ACCOUNT_LABELS[account.account] ?? account.account}
                      </span>
                      <span className="shrink-0 font-mono tabular text-slate-700">
                        {formatTZS(account.debit)} / {formatTZS(account.credit)}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <ShieldCheck className="h-3 w-3" />
                  Debits = credits is enforced inside every money transaction.
                </p>
              </SectionCard>
            </div>
          </div>

          <SectionCard
            title="Recent audit activity"
            description="Append-only trail of every admin action on this campus."
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => audit.reload()}
                disabled={audit.loading}
              >
                <ScrollText className="h-3.5 w-3.5" />
                {audit.data?.total ? `${audit.data.total} entries` : 'Audit log'}
              </Button>
            }
          >
            {audit.error ? (
              <Alert variant="danger">{audit.error}</Alert>
            ) : audit.loading && !audit.data ? (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <div key={row} className="h-12 animate-pulse rounded-lg bg-slate-100" />
                ))}
              </div>
            ) : (
              <AuditList
                entries={audit.data?.logs ?? []}
                emptyDescription="Refund decisions, menu approvals, vendor changes and manual adjustments will show up here."
              />
            )}
          </SectionCard>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
            <Wallet className="h-3.5 w-3.5" />
            Ledger and billing figures are read-only snapshots; only profile fields can be edited
            from this page.
          </p>
        </>
      ) : null}
    </div>
  );
}
