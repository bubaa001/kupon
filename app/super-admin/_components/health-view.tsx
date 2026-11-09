'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  CreditCard,
  Database,
  QrCode,
  RefreshCw,
  RotateCcw,
  Scale,
  Server,
  ShieldCheck,
  Smartphone,
  Timer,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
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
import { cn, formatNumber, formatTZS, formatTime, relativeTime } from '@/lib/utils';
import {
  IncidentSeverityBadge,
  MockBadge,
  ServiceStatusBadge,
} from './badges';
import { HealthTrendChart } from './health-trend-chart';
import type { HealthData, Incident, ServiceHealth } from './types';
import { useApiData } from './use-api-data';

const SERVICE_ICONS: Record<string, LucideIcon> = {
  api: Server,
  database: Database,
  ledger: Scale,
  aggregator: Smartphone,
  saas: CreditCard,
  tokens: QrCode,
};

export function HealthView() {
  const { data, error, loading, refreshing, reload } = useApiData<HealthData>(
    '/api/super-admin/health',
  );

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bubaa Comp · Reliability"
          title="System health"
          description="Live ledger invariants and payment success rate, with labelled demo metrics."
        />
        <Alert variant="danger" title="Could not load system health">
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

  const { ledger } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bubaa Comp · Reliability"
        title="System health"
        description="Ledger invariants, payment success and incidents are computed live from the Kupon database. Uptime history and service latency are labelled demo metrics."
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={refreshing ? 'outline' : 'success'} dot>
              {refreshing ? 'Updating…' : 'Auto-updates · 15s'}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reload({ silent: true })}
              loading={refreshing}
            >
              {refreshing ? null : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        }
      />

      <Alert variant="info" title="What is live and what is mocked">
        Success rate, failed payments, ledger balance, active QR tokens, invoice exposure and
        incidents are real database results. Uptime % and typical service latency are illustrative
        demo values — there is no metrics store in this MVP — and every surface labels them.
      </Alert>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Uptime · 30 days"
          value={`${data.uptimePercent.toFixed(2)}%`}
          icon={Activity}
          accent="emerald"
          hint="Mock · illustrative rolling uptime"
        />
        <StatCard
          label="Payment success · 7d"
          value={`${data.successRate}%`}
          icon={ShieldCheck}
          accent="sky"
          hint={`${formatNumber(data.settled7d)} settled · ${formatNumber(
            data.failed7d,
          )} failed`}
        />
        <StatCard
          label="Avg latency"
          value={`${formatNumber(data.avgLatencyMs)} ms`}
          icon={Timer}
          accent="violet"
          hint="Mock · not instrumented yet"
        />
        <StatCard
          label="Failed today"
          value={formatNumber(data.failedToday)}
          icon={AlertTriangle}
          accent="rose"
          hint="auto-detected in DB"
        />
        <StatCard
          label="Pending refunds"
          value={formatNumber(data.pendingRefunds)}
          icon={RotateCcw}
          accent="amber"
          hint="Across all universities"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Scale className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900">Ledger invariant</p>
                <p className="text-[11px] text-slate-500">Double-entry journal check</p>
              </div>
            </div>
            <Badge variant={ledger.balanced ? 'success' : 'danger'} dot>
              {ledger.balanced ? 'Balanced' : 'Out of balance'}
            </Badge>
          </div>

          <dl className="mt-4 space-y-2.5">
            <LedgerRow label="Total debits" value={formatTZS(ledger.debits)} />
            <LedgerRow label="Total credits" value={formatTZS(ledger.credits)} />
            <LedgerRow
              label="Difference"
              value={formatTZS(ledger.difference)}
              tone={ledger.difference === 0 ? 'ok' : 'bad'}
            />
            <LedgerRow label="Journal entries" value={formatNumber(ledger.entries)} />
          </dl>

          <Alert
            variant={ledger.balanced ? 'success' : 'danger'}
            className="mt-4"
            title={ledger.balanced ? 'Invariant holds' : 'Imbalance detected'}
          >
            {ledger.balanced
              ? 'SUM(debit) equals SUM(credit) for every tenant.'
              : `Debits and credits differ by ${formatTZS(
                  Math.abs(ledger.difference),
                )}. Freeze financial writes and investigate.`}
          </Alert>

          <Button asChild variant="outline" size="sm" className="mt-4 w-full">
            <Link href="/super-admin/revenue">
              <Scale className="h-4 w-4" />
              View platform revenue
            </Link>
          </Button>
        </div>

        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Payment outcomes · last 7 days</p>
              <p className="mt-1 text-xs text-slate-500">
                Settled vs failed attempts across every university.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="success">{formatNumber(data.settled7d)} settled</Badge>
              <Badge variant="danger">{formatNumber(data.failed7d)} failed</Badge>
            </div>
          </div>
          <div className="mt-4">
            <HealthTrendChart data={data.trend} height={222} />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Service statuses
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Six platform services · checked at {formatTime(data.generatedAt)}
            </p>
          </div>
          <Badge variant="outline">{data.services.length} services</Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">
              Recent incidents
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Auto-generated from real failed transactions in the last 7 days
            </p>
          </div>
          {data.incidents.length > 0 ? (
            <Badge variant="warning" dot>
              {data.incidents.filter((incident) => incident.status === 'OPEN').length} open
            </Badge>
          ) : null}
        </div>

        {data.incidents.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No incidents in the last 7 days"
            description="Every payment attempt has settled cleanly. New failures appear here automatically."
          />
        ) : (
          <>
            <div className="card-surface hidden overflow-hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Detail</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.incidents.map((incident) => (
                    <TableRow key={incident.id}>
                      <TableCell>
                        <IncidentSeverityBadge severity={incident.severity} />
                      </TableCell>
                      <TableCell>
                        <p className="tabular text-xs font-semibold text-slate-800">
                          {incident.reference}
                        </p>
                        <p className="text-[11px] text-slate-400">{incident.service}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-800">
                          {incident.universityName}
                        </p>
                        <p className="text-[11px] text-slate-400">{incident.universityCode}</p>
                      </TableCell>
                      <TableCell className="text-right tabular text-sm">
                        {formatTZS(incident.amount)}
                      </TableCell>
                      <TableCell>
                        <p
                          className="max-w-[220px] truncate text-xs text-slate-600"
                          title={incident.failureReason}
                        >
                          {incident.failureReason}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-xs text-slate-600">
                          {relativeTime(incident.occurredAt)}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={incident.status === 'OPEN' ? 'warning' : 'neutral'} dot>
                          {incident.status === 'OPEN' ? 'Open' : 'Resolved'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {data.incidents.map((incident) => (
                <IncidentCard key={incident.id} incident={incident} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function LedgerRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'bad';
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={cn(
          'tabular text-sm font-semibold',
          tone === 'ok' && 'text-emerald-700',
          tone === 'bad' && 'text-red-600',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  const Icon = SERVICE_ICONS[service.id] ?? Activity;

  return (
    <div className="card-surface min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
              service.status === 'OPERATIONAL' && 'bg-emerald-50 text-emerald-600',
              service.status === 'DEGRADED' && 'bg-amber-50 text-amber-600',
              service.status === 'OUTAGE' && 'bg-red-50 text-red-600',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-900">{service.name}</p>
            <p className="text-[11px] text-slate-400 tabular">
              ~{formatNumber(service.latencyMs)} ms
              {service.mock ? ' (mock latency)' : ' (live probe)'}
            </p>
          </div>
        </div>
        <ServiceStatusBadge status={service.status} />
      </div>

      <p className="mt-2.5 text-xs leading-relaxed text-slate-500">{service.detail}</p>

      <div className="mt-2.5 flex items-center gap-1.5">
        {service.mock ? <MockBadge /> : (
          <Badge variant="success" dot>
            Live check
          </Badge>
        )}
      </div>
    </div>
  );
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <div className="card-surface min-w-0 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="tabular text-xs font-semibold text-slate-800">{incident.reference}</p>
          <p className="text-[11px] text-slate-400">
            {incident.service} · {relativeTime(incident.occurredAt)}
          </p>
        </div>
        <IncidentSeverityBadge severity={incident.severity} />
      </div>

      <p className="mt-2 text-xs leading-relaxed text-slate-600">{incident.failureReason}</p>

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-600">
          {incident.universityName}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular text-xs font-semibold text-slate-900">
            {formatTZS(incident.amount)}
          </span>
          <Badge variant={incident.status === 'OPEN' ? 'warning' : 'neutral'} dot>
            {incident.status === 'OPEN' ? 'Open' : 'Resolved'}
          </Badge>
        </span>
      </div>
    </div>
  );
}
