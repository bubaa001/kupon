'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  Building2,
  CreditCard,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Store,
  Users,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn, formatNumber, formatTZS } from '@/lib/utils';
import { InvoiceStatusBadge, TenantHealthBadge, UniversityStatusBadge } from './badges';
import { OnboardTenantDialog } from './onboard-tenant-dialog';
import { EditTenantDialog, TenantStatusDialog } from './tenant-dialogs';
import type { TenantListData, TenantSummary } from './types';
import { useApiData } from './use-api-data';

type StatusFilter = 'ALL' | 'ACTIVE' | 'SUSPENDED';

export function TenantsView() {
  const { data, error, loading, refreshing, reload } = useApiData<TenantListData>(
    '/api/super-admin/tenants',
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<TenantSummary | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    tenant: TenantSummary;
    status: 'ACTIVE' | 'SUSPENDED';
  } | null>(null);

  // Quick action from the overview links here with ?onboard=1 and opens the
  // provisioning dialog immediately. The param is cleared so a refresh does not
  // reopen the dialog unexpectedly.
  useEffect(() => {
    if (window.location.search.includes('onboard=1')) {
      setOnboardOpen(true);
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const tenants = useMemo(() => data?.tenants ?? [], [data]);
  const summary = data?.summary;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tenants.filter((tenant) => {
      if (statusFilter !== 'ALL' && tenant.status !== statusFilter) return false;
      if (!term) return true;
      return [
        tenant.name,
        tenant.code,
        tenant.city,
        tenant.routeCode,
        tenant.adminName ?? '',
        tenant.adminPhone ?? '',
      ].some((value) => value.toLowerCase().includes(term));
    });
  }, [tenants, search, statusFilter]);

  const refresh = () => {
    void reload({ silent: true });
  };

  if (loading) return <PageSkeleton />;

  if (error || !data || !summary) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bubaa Comp · Tenants"
          title="Universities"
          description="Onboard, bill and manage every campus on the Kupon network."
        />
        <Alert variant="danger" title="Could not load universities">
          {error ?? 'The platform API returned no data.'}{' '}
          <button
            type="button"
            onClick={() => void reload()}
            className="font-semibold underline underline-offset-4"
          >
            Try again
          </button>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bubaa Comp · Tenants"
        title="Universities"
        description="Onboard, bill and manage every campus on the Kupon network."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload({ silent: true })}
              loading={refreshing}
            >
              {refreshing ? null : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
            <Button size="sm" onClick={() => setOnboardOpen(true)}>
              <Plus className="h-4 w-4" />
              Onboard university
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active tenants"
          value={`${summary.active} / ${summary.total}`}
          icon={Building2}
          accent="emerald"
          hint={
            summary.suspended > 0
              ? `${summary.suspended} suspended`
              : 'Every university is active'
          }
        />
        <StatCard
          label="Students onboarded"
          value={formatNumber(summary.students)}
          icon={Users}
          accent="sky"
          hint="across all universities"
        />
        <StatCard
          label="Vendors live"
          value={formatNumber(summary.vendors)}
          icon={Store}
          accent="amber"
          hint="campus cafeterias and canteens"
        />
        <StatCard
          label="SaaS MRR"
          value={formatTZS(summary.saasMrr)}
          icon={CreditCard}
          accent="violet"
          hint={`${summary.pendingInvoices} invoice${
            summary.pendingInvoices === 1 ? '' : 's'
          } pending`}
        />
      </div>

      <div className="card-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, code or Lipa Namba…"
            className="pl-9"
            aria-label="Search universities"
          />
        </div>

        <div
          className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1"
          role="group"
          aria-label="Filter by tenant status"
        >
          {(
            [
              { value: 'ALL', label: 'All', count: summary.total },
              { value: 'ACTIVE', label: 'Active', count: summary.active },
              { value: 'SUSPENDED', label: 'Suspended', count: summary.suspended },
            ] as const
          ).map((option) => {
            const active = statusFilter === option.value;
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(option.value)}
                className={cn(
                  'inline-flex min-h-[32px] items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800',
                )}
              >
                {option.label}
                <span
                  className={cn(
                    'tabular rounded-full px-1.5 text-[10px]',
                    active
                      ? 'bg-primary-50 text-primary-700'
                      : 'bg-slate-200/70 text-slate-500',
                  )}
                >
                  {option.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {tenants.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No universities onboarded yet"
          description="Create the first tenant to start collecting platform fees and SaaS subscriptions."
          action={
            <Button size="sm" onClick={() => setOnboardOpen(true)}>
              <Plus className="h-4 w-4" />
              Onboard university
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No universities match this filter"
          description="Try a different search term or reset the status filter."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
              }}
            >
              Clear filters
            </Button>
          }
        />
      ) : (
        <>
          <div className="card-surface hidden overflow-hidden lg:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>University</TableHead>
                  <TableHead>Lipa Namba</TableHead>
                  <TableHead className="text-right">Students / Vendors</TableHead>
                  <TableHead className="text-right">GMV (30d)</TableHead>
                  <TableHead className="text-right">Fees (30d)</TableHead>
                  <TableHead>SaaS billing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase text-white"
                          style={{ backgroundColor: tenant.brandColor }}
                          aria-hidden
                        >
                          {tenant.code.slice(0, 2)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {tenant.name}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tenant.code} · {tenant.city}
                          </p>
                          <p className="truncate text-[11px] text-slate-400">
                            {tenant.adminName ?? 'No admin linked'}
                            {tenant.adminPhone ? ` · ${tenant.adminPhone}` : ''}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="tabular whitespace-nowrap text-sm text-slate-700">
                        {tenant.routeCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular whitespace-nowrap text-sm text-slate-700">
                        {tenant.students}
                      </span>
                      <span className="text-slate-300"> / </span>
                      <span className="tabular whitespace-nowrap text-sm text-slate-700">
                        {tenant.vendors}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular whitespace-nowrap text-sm font-semibold text-slate-900">
                        {formatTZS(tenant.gmv30d)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="tabular whitespace-nowrap text-sm text-slate-700">
                        {formatTZS(tenant.platformFee30d)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <p className="tabular whitespace-nowrap text-sm text-slate-700">
                        {formatTZS(tenant.saasFee)}
                        <span className="text-[11px] font-normal text-slate-400">/mo</span>
                      </p>
                      <div className="mt-0.5 flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-[11px] text-slate-400">
                          {tenant.lastInvoice ? tenant.lastInvoice.period : 'No invoice'}
                        </span>
                        {tenant.lastInvoice ? (
                          <InvoiceStatusBadge status={tenant.lastInvoice.status} />
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        <UniversityStatusBadge status={tenant.status} />
                        <TenantHealthBadge health={tenant.health} />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit ${tenant.name}`}
                          onClick={() => setEditTenant(tenant)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {tenant.status === 'ACTIVE' ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Suspend ${tenant.name}`}
                            onClick={() =>
                              setStatusTarget({ tenant, status: 'SUSPENDED' })
                            }
                          >
                            <Ban className="h-4 w-4 text-red-500" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Reactivate ${tenant.name}`}
                            onClick={() => setStatusTarget({ tenant, status: 'ACTIVE' })}
                          >
                            <Play className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
            {filtered.map((tenant) => (
              <TenantCard
                key={tenant.id}
                tenant={tenant}
                onEdit={() => setEditTenant(tenant)}
                onToggleStatus={() =>
                  setStatusTarget({
                    tenant,
                    status: tenant.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE',
                  })
                }
              />
            ))}
          </div>
        </>
      )}

      <OnboardTenantDialog open={onboardOpen} onOpenChange={setOnboardOpen} onCreated={refresh} />

      <EditTenantDialog
        tenant={editTenant}
        open={Boolean(editTenant)}
        onOpenChange={(open) => {
          if (!open) setEditTenant(null);
        }}
        onUpdated={refresh}
      />

      <TenantStatusDialog
        tenant={statusTarget?.tenant ?? null}
        targetStatus={statusTarget?.status ?? 'SUSPENDED'}
        open={Boolean(statusTarget)}
        onOpenChange={(open) => {
          if (!open) setStatusTarget(null);
        }}
        onUpdated={refresh}
      />
    </div>
  );
}

function TenantCard({
  tenant,
  onEdit,
  onToggleStatus,
}: {
  tenant: TenantSummary;
  onEdit: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <div className="card-surface flex min-w-0 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold uppercase text-white"
            style={{ backgroundColor: tenant.brandColor }}
            aria-hidden
          >
            {tenant.code.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900" title={tenant.name}>
              {tenant.name}
            </p>
            <p className="text-[11px] text-slate-500">
              {tenant.code} · {tenant.city}
            </p>
          </div>
        </div>
        <UniversityStatusBadge status={tenant.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className="tabular">
          Lipa Namba {tenant.routeCode}
        </Badge>
        <TenantHealthBadge health={tenant.health} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            GMV (30d)
          </dt>
          <dd className="tabular text-sm font-semibold text-slate-900">
            {formatTZS(tenant.gmv30d)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Fees (30d)
          </dt>
          <dd className="tabular text-sm font-semibold text-slate-900">
            {formatTZS(tenant.platformFee30d)}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Students / Vendors
          </dt>
          <dd className="tabular text-sm text-slate-700">
            {tenant.students} / {tenant.vendors}
          </dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            SaaS billing
          </dt>
          <dd className="text-sm text-slate-700">
            <span className="tabular whitespace-nowrap">{formatTZS(tenant.saasFee)}</span>
            {tenant.lastInvoice ? (
              <span className="mt-1 block">
                <InvoiceStatusBadge status={tenant.lastInvoice.status} />
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-400">
        <Users className="h-3 w-3" />
        Admin: {tenant.adminName ?? 'not linked'}
        {tenant.adminPhone ? ` · ${tenant.adminPhone}` : ''}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
        <Button
          variant={tenant.status === 'ACTIVE' ? 'outline' : 'default'}
          size="sm"
          onClick={onToggleStatus}
        >
          {tenant.status === 'ACTIVE' ? (
            <>
              <Ban className="h-4 w-4 text-red-500" />
              Suspend
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Reactivate
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
