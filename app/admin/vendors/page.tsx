'use client';

import { useMemo, useState } from 'react';
import {
  BarChart3,
  RefreshCw,
  SearchX,
  Store,
  TrendingUp,
  UserX,
  Wallet,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { PageSkeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { ApiClientError, patchJson } from '@/lib/client-api';
import { formatTZS } from '@/lib/utils';
import type { VendorListData, VendorRow } from '../_components/types';
import { queryString, useApiData, useDebouncedValue } from '../_components/hooks';
import { ConfirmDialog } from '../_components/confirm-dialog';
import { VendorSalesDialog } from '../_components/vendor-dialogs';
import { RangeTabs, SearchField, SectionCard, TableEmpty } from '../_components/ui-bits';

type StatusFilter = 'ALL' | 'PENDING' | 'ACTIVE' | 'SUSPENDED';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

export default function AdminVendorsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [salesVendor, setSalesVendor] = useState<VendorRow | null>(null);
  const [confirmVendor, setConfirmVendor] = useState<VendorRow | null>(null);
  const [busy, setBusy] = useState(false);

  const url = useMemo(
    () =>
      `/api/admin/vendors${queryString({
        q: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
      })}`,
    [debouncedSearch, status],
  );
  const { data, error, loading, reload } = useApiData<VendorListData>(url);

  const vendors = data?.vendors ?? [];

  async function toggleStatus(vendor: VendorRow) {
    const nextStatus = vendor.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    setBusy(true);
    try {
      await patchJson(`/api/admin/vendors/${vendor.id}`, { status: nextStatus });
      toast.success(
        nextStatus === 'SUSPENDED'
          ? `${vendor.name} is suspended. They can no longer charge students.`
          : `${vendor.name} is active again.`,
      );
      setConfirmVendor(null);
      reload();
    } catch (caught) {
      toast.error(
        caught instanceof ApiClientError ? caught.message : 'Could not update the vendor.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Campus vendors"
        title="Vendors"
        description={
          data?.university
            ? `Cafeteria accounts selling to ${data.university.name} students. Suspending a vendor blocks new payments immediately.`
            : 'Manage approved cafeterias in your university. New applications and approvals are handled by the platform team.'
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </>
        }
      />

      {error ? (
        <Alert variant="danger" title="Could not load vendors">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            <Button type="button" size="sm" variant="outline" onClick={reload}>
              Try again
            </Button>
          </div>
        </Alert>
      ) : null}

      {loading && !data ? (
        <PageSkeleton />
      ) : error && !data ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Sales today"
              value={data ? formatTZS(data.summary.salesToday) : '—'}
              icon={Wallet}
              accent="emerald"
              hint={data ? `${data.summary.transactionsToday} settled payments` : 'Loading…'}
            />
            <StatCard
              label="Pending settlement"
              value={data ? formatTZS(data.summary.pendingSettlement) : '—'}
              icon={TrendingUp}
              accent="amber"
              hint="Owed to vendors right now"
            />
            <StatCard
              label="Active vendors"
              value={data ? String(data.summary.active) : '—'}
              icon={Store}
              accent="sky"
              hint={
                data
                  ? `${data.summary.total} registered${data.summary.pending ? ` • ${data.summary.pending} pending` : ''}`
                  : 'Loading…'
              }
            />
            <StatCard
              label="Suspended"
              value={data ? String(data.summary.suspended) : '—'}
              icon={UserX}
              accent="rose"
              hint="Blocked from charging students"
            />
          </div>

          <SectionCard contentClassName="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Vendor name, code or owner…"
                ariaLabel="Search vendors"
              />
              <RangeTabs value={status} onChange={setStatus} options={STATUS_OPTIONS} />
            </div>

            {vendors.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {vendors.map((vendor) => (
                  <div
                    key={vendor.id}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-card transition-shadow hover:shadow-lift"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={vendor.name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {vendor.name}
                          </p>
                          <Badge
                            variant={
                              vendor.status === 'ACTIVE'
                                ? 'success'
                                : vendor.status === 'PENDING'
                                  ? 'warning'
                                  : 'danger'
                            }
                            dot
                            className="shrink-0"
                          >
                            {vendor.status === 'ACTIVE'
                              ? 'Active'
                              : vendor.status === 'PENDING'
                                ? 'Pending'
                                : 'Suspended'}
                          </Badge>
                        </div>
                        <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                          {vendor.code}
                        </p>
                      </div>
                    </div>

                    <p className="line-clamp-2 min-h-[32px] text-[11px] leading-relaxed text-slate-500">
                      {vendor.description || 'No description added.'}
                    </p>

                    <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-center">
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          Today
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold tabular text-slate-800">
                          {formatTZS(vendor.salesToday)}
                        </p>
                      </div>
                      <div className="border-x border-slate-200">
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          Payments
                        </p>
                        <p className="mt-0.5 text-[11px] font-semibold tabular text-slate-800">
                          {vendor.transactionsToday}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                          Pending
                        </p>
                        <p className="mt-0.5 truncate text-[11px] font-semibold tabular text-amber-700">
                          {formatTZS(vendor.pendingBalance)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                      <span className="truncate">
                        {vendor.ownerName} • {vendor.ownerPhone}
                      </span>
                      <span className="hidden shrink-0 text-slate-400 sm:block">
                        {vendor.settlementAccount}
                      </span>
                    </div>

                    <div className="mt-auto flex gap-2 border-t border-slate-100 pt-3">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setSalesVendor(vendor)}
                      >
                        <BarChart3 className="h-3.5 w-3.5" />
                        View sales
                      </Button>
                      {vendor.status === 'PENDING' ? (
                        <span className="self-center text-[10px] font-medium text-amber-700">
                          Platform review required
                        </span>
                      ) : vendor.status === 'ACTIVE' ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setConfirmVendor(vendor)}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button type="button" size="sm" onClick={() => setConfirmVendor(vendor)}>
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <TableEmpty
                icon={search ? SearchX : Store}
                title={search || status !== 'ALL' ? 'No vendors match'                 : 'No cafeteria vendors yet'}
                description={
                  search || status !== 'ALL'
                    ? 'Clear the search or switch back to all vendors.'
                    : 'Cafeteria owners apply with Google. The platform team reviews documents and confirms the location before activation.'
                }
              />
            )}
          </SectionCard>
        </>
      )}

      <VendorSalesDialog
        vendor={salesVendor}
        open={Boolean(salesVendor)}
        onOpenChange={(open) => {
          if (!open) setSalesVendor(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmVendor)}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmVendor(null);
        }}
        title={confirmVendor?.status === 'ACTIVE' ? 'Suspend this vendor?' : 'Reactivate this vendor?'}
        description={
          confirmVendor?.status === 'ACTIVE'
            ? `${confirmVendor.name} will be blocked from charging students immediately. Their pending settlement stays intact and the action is written to the audit log.`
            : `${confirmVendor?.name ?? 'This vendor'} will be able to accept orders again. The action is written to the audit log.`
        }
        confirmLabel={confirmVendor?.status === 'ACTIVE' ? 'Suspend vendor' : 'Reactivate vendor'}
        variant={confirmVendor?.status === 'ACTIVE' ? 'destructive' : 'default'}
        loading={busy}
        onConfirm={() => {
          if (confirmVendor) void toggleStatus(confirmVendor);
        }}
      />
    </div>
  );
}
