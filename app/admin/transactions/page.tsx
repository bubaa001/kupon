'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ListFilter,
  RefreshCw,
  SearchX,
  Store,
  CircleDollarSign,
  Percent,
  ReceiptText,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { Select } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { STATUS_BADGE, TX_STATUSES } from '@/lib/constants';
import { formatTZS } from '@/lib/utils';
import type { TxListData, TxRow } from '../_components/types';
import { queryString, useApiData, useDebouncedValue } from '../_components/hooks';
import {
  DataTableSkeleton,
  ExportActions,
  FilterField,
  Pagination,
  PrintHeader,
  RangeTabs,
  SearchField,
  SectionCard,
  TableEmpty,
} from '../_components/ui-bits';
import { TransactionTable } from '../_components/transaction-table';
import { TransactionDetailDialog } from '../_components/transaction-detail-dialog';
import { rangeOptionLabel } from '../_components/format';

type RangeValue = 'today' | '7d' | '30d' | 'mtd' | 'all';

const RANGE_OPTIONS: { value: RangeValue; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'mtd', label: 'Month to date' },
  { value: 'all', label: 'All time' },
];

const PAGE_SIZE = 20;

export default function AdminTransactionsPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [status, setStatus] = useState('ALL');
  const [range, setRange] = useState<RangeValue>('7d');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<TxRow | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');

  useEffect(() => {
    setGeneratedAt(new Date().toLocaleString('en-GB'));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const url = useMemo(
    () =>
      `/api/admin/transactions${queryString({
        q: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
        type: 'PAYMENT',
        range,
        page,
        pageSize: PAGE_SIZE,
      })}`,
    [debouncedSearch, status, range, page],
  );

  const { data, error, loading, reload } = useApiData<TxListData>(url);

  const exportHref = useMemo(
    () =>
      `/api/admin/transactions/export${queryString({
        q: debouncedSearch || undefined,
        status: status === 'ALL' ? undefined : status,
        type: 'PAYMENT',
        range,
      })}`,
    [debouncedSearch, status, range],
  );

  const filtersActive = Boolean(search) || status !== 'ALL' || range !== '7d';

  function resetFilters() {
    setSearch('');
    setStatus('ALL');
    setRange('7d');
    setPage(1);
  }

  const printSubtitle = [
    rangeOptionLabel(range),
    status === 'ALL' ? 'All statuses' : `${STATUS_BADGE[status as keyof typeof STATUS_BADGE]?.label ?? status}`,
    'Meal payments',
    debouncedSearch ? `Search “${debouncedSearch}”` : null,
    generatedAt ? `Generated ${generatedAt}` : null,
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="space-y-5">
      <PrintHeader title="Transaction ledger" subtitle={printSubtitle} />

      <PageHeader
        eyebrow="Order activity"
        title="Transactions"
        description="Meal payment records from the Kupon test gateway. No real money is collected in this build."
        actions={
          <div className="no-print flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={reload}
              disabled={loading}
            >
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <ExportActions csvHref={exportHref} onPrint={() => window.print()} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Settled meal volume"
          value={data ? formatTZS(data.summary.gross) : '—'}
          icon={CircleDollarSign}
          accent="emerald"
          hint="Matching settled payments"
        />
        <StatCard
          label="Platform fees"
          value={data ? formatTZS(data.summary.fees) : '—'}
          icon={Percent}
          accent="amber"
          hint="Kupon + university + aggregator"
        />
        <StatCard
          label="Net to vendors"
          value={data ? formatTZS(data.summary.net) : '—'}
          icon={Store}
          accent="sky"
          hint="After platform fees"
        />
        <StatCard
          label="Matched records"
          value={data ? String(data.total) : '—'}
          icon={ListFilter}
          accent="violet"
          hint="In the current filter"
        />
      </div>

      <SectionCard contentClassName="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Reference, student, vendor, amount…"
              ariaLabel="Search transactions"
            />
            <div className="grid grid-cols-1 gap-2 sm:flex">
              <FilterField label="Status" className="sm:w-36">
                <Select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  aria-label="Filter by status"
                >
                  <option value="ALL">All statuses</option>
                  {TX_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {STATUS_BADGE[item].label}
                    </option>
                  ))}
                </Select>
              </FilterField>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <RangeTabs
              value={range}
              onChange={(next) => {
                setRange(next);
                setPage(1);
              }}
              options={RANGE_OPTIONS}
            />
            {filtersActive ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                Reset
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <Alert variant="danger" title="Could not load transactions">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>{error}</span>
              <Button type="button" size="sm" variant="outline" onClick={reload}>
                Try again
              </Button>
            </div>
          </Alert>
        ) : loading && !data ? (
          <DataTableSkeleton rows={8} columns={6} />
        ) : data && data.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <TransactionTable rows={data.rows} onSelect={setSelected} />
          </div>
        ) : (
          <TableEmpty
            icon={SearchX}
            title="No transactions match these filters"
            description="Try a wider date range, clear the search, or switch the status back to all."
            action={
              filtersActive ? (
                <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        )}

        {data ? (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            total={data.total}
            onChange={setPage}
          />
        ) : null}
      </SectionCard>

      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <ReceiptText className="h-3.5 w-3.5" />
        CSV exports the same filtered ledger (up to 5,000 rows); PDF uses your browser print
        dialog.
        {data ? (
          <Badge variant="outline" className="ml-auto hidden sm:inline-flex">
            {data.rows.length} on this page
          </Badge>
        ) : null}
      </div>

      <TransactionDetailDialog
        row={selected}
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      />
    </div>
  );
}
