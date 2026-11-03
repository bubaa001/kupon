'use client';

import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Building2,
  CreditCard,
  Percent,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { SectionHeading } from '@/components/ui/section-heading';
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
import { RevenueAreaChart } from '@/components/charts/revenue-area-chart';
import { cn, formatCompactTZS, formatNumber, formatTZS } from '@/lib/utils';
import { InvoiceStatusBadge, TenantHealthBadge, UniversityStatusBadge } from './badges';
import type { OverviewData, TenantSummary } from './types';
import { useApiData } from './use-api-data';

export function OverviewView() {
  const { data, error, loading, refreshing, reload } = useApiData<OverviewData>(
    '/api/super-admin/overview',
  );

  if (loading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Bubaa Comp · Platform control"
          title="Platform overview"
          description="Live GMV, fee revenue and tenant health across every Kupon university."
        />
        <Alert variant="danger" title="Could not load the platform overview">
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

  const { platform, universities, chart } = data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bubaa Comp · Platform control"
        title="Platform overview"
        description="Live GMV, fee revenue and tenant health across every Kupon university."
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
            <Button asChild size="sm">
              <Link href="/super-admin/tenants?onboard=1">
                <Plus className="h-4 w-4" />
                Onboard university
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total GMV today"
          value={formatTZS(platform.gmvToday)}
          icon={Wallet}
          accent="emerald"
          delta={platform.gmvChangePercent ?? undefined}
          hint="vs yesterday"
        />
        <StatCard
          label="Platform fee revenue"
          value={formatTZS(platform.platformFee30d)}
          icon={Percent}
          accent="sky"
          delta={platform.platformFeeChangePercent ?? undefined}
          hint="last 30 days · settled"
        />
        <StatCard
          label="SaaS MRR"
          value={formatTZS(platform.saasMrr)}
          icon={CreditCard}
          accent="violet"
          hint={`${formatCompactTZS(platform.saasCollected)} collected`}
        />
        <StatCard
          label="Active tenants"
          value={`${platform.activeTenants} / ${platform.totalTenants}`}
          icon={Building2}
          accent="navy"
          hint={`${formatNumber(platform.totalStudents)} students · ${formatNumber(
            platform.totalVendors,
          )} vendors`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card-surface p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Platform fee revenue</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 tabular">
                {formatTZS(platform.platformFee7d)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Fees collected on settled payments · last 7 days
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="tabular">
                {formatTZS(platform.gmv7d)} GMV
              </Badge>
              <Badge variant="success" dot>
                Live data
              </Badge>
            </div>
          </div>
          <div className="mt-4">
            <RevenueAreaChart data={chart} height={260} />
          </div>
          {platform.platformFee7d === 0 ? (
            <p className="mt-2 text-center text-xs text-slate-400">
              No settled meal payments in the last 7 days yet.
            </p>
          ) : null}
        </div>

        <div className="card-surface flex flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="eyebrow">Network pulse</p>
            <Badge variant={platform.ledgerBalanced ? 'success' : 'danger'} dot>
              {platform.ledgerBalanced ? 'Ledger balanced' : 'Ledger issue'}
            </Badge>
          </div>
          <dl className="mt-4 space-y-3">
            <PulseRow
              label="Payment success (7d)"
              value={`${platform.successRate7d}%`}
              tone={platform.successRate7d >= 95 ? 'ok' : 'warn'}
            />
            <PulseRow
              label="Failed payments today"
              value={`${platform.failedToday}`}
              tone={platform.failedToday > 0 ? 'warn' : 'ok'}
            />
            <PulseRow label="Pending refunds" value={`${platform.pendingRefunds}`} />
            <PulseRow label="GMV (30d)" value={formatTZS(platform.gmv30d)} />
            <PulseRow
              label="Transaction-fee net (30d)"
              value={formatTZS(platform.transactionNet30d)}
              tone={platform.transactionNet30d < 0 ? 'danger' : 'ok'}
            />
            <PulseRow
              label="University share (30d)"
              value={formatTZS(platform.universityRevenue30d)}
            />
            <PulseRow label="Rail costs (30d)" value={formatTZS(platform.aggregatorCosts30d)} />
          </dl>
          <div className="mt-4 flex-1" />
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link href="/super-admin/health">
              <Activity className="h-4 w-4" />
              Open system health
            </Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading
          title="Universities"
          description="Adoption, revenue and health per tenant · last 30 days"
          actionLabel="Manage tenants"
          actionHref="/super-admin/tenants"
        />

        {universities.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="No universities yet"
            description="Onboard your first campus to start collecting platform fees and SaaS subscriptions."
            action={
              <Button asChild size="sm">
                <Link href="/super-admin/tenants?onboard=1">
                  <Plus className="h-4 w-4" />
                  Onboard university
                </Link>
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
                    <TableHead className="text-right">GMV today</TableHead>
                    <TableHead className="text-right">Fees (30d)</TableHead>
                    <TableHead>SaaS</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {universities.map((tenant) => (
                    <TenantRow key={tenant.id} tenant={tenant} />
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
              {universities.map((tenant) => (
                <TenantCard key={tenant.id} tenant={tenant} />
              ))}
            </div>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuickAction
          href="/super-admin/tenants?onboard=1"
          icon={Plus}
          title="Onboard a university"
          description="Provision the tenant, its admin login and first SaaS invoice."
        />
        <QuickAction
          href="/super-admin/tenants"
          icon={Building2}
          title="Manage tenants"
          description="Suspend, reactivate or reassign a Lipa Namba route code."
        />
        <QuickAction
          href="/super-admin/revenue"
          icon={TrendingUp}
          title="Platform revenue"
          description="Fee waterfall, SaaS billing, rail costs and ledger health."
        />
        <QuickAction
          href="/super-admin/health"
          icon={Activity}
          title="System health"
          description="Uptime, incidents and the double-entry ledger invariant."
        />
      </div>
    </div>
  );
}

function PulseRow({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'danger';
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-2.5 last:border-0 last:pb-0">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd
        className={cn(
          'tabular text-sm font-semibold',
          tone === 'ok' && 'text-emerald-700',
          tone === 'warn' && 'text-amber-600',
          tone === 'danger' && 'text-red-600',
          tone === 'neutral' && 'text-slate-900',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function TenantRow({ tenant }: { tenant: TenantSummary }) {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold uppercase text-white"
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
      </TableCell>
      <TableCell>
        <span className="tabular whitespace-nowrap text-sm text-slate-700">{tenant.routeCode}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="tabular whitespace-nowrap text-sm text-slate-700">{tenant.students}</span>
        <span className="text-slate-300"> / </span>
        <span className="tabular whitespace-nowrap text-sm text-slate-700">{tenant.vendors}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="tabular whitespace-nowrap text-sm font-semibold text-slate-900">
          {formatTZS(tenant.gmvToday)}
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
          {tenant.lastInvoice ? <InvoiceStatusBadge status={tenant.lastInvoice.status} /> : null}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          <TenantHealthBadge health={tenant.health} />
          <UniversityStatusBadge status={tenant.status} />
        </div>
      </TableCell>
      <TableCell className="text-right">
        <Button asChild variant="ghost" size="sm">
          <Link href="/super-admin/tenants">
            Manage
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function TenantCard({ tenant }: { tenant: TenantSummary }) {
  return (
    <div className="card-surface min-w-0 p-4">
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

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            GMV today
          </dt>
          <dd className="tabular text-sm font-semibold text-slate-900">
            {formatTZS(tenant.gmvToday)}
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
            SaaS / month
          </dt>
          <dd className="tabular text-sm text-slate-700">{formatTZS(tenant.saasFee)}</dd>
        </div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <TenantHealthBadge health={tenant.health} />
        <Badge variant="outline" className="tabular">
          Lipa Namba {tenant.routeCode}
        </Badge>
        {tenant.lastInvoice ? <InvoiceStatusBadge status={tenant.lastInvoice.status} /> : null}
      </div>

      <Button asChild variant="outline" size="sm" className="mt-3 w-full">
        <Link href="/super-admin/tenants">
          Manage tenant
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof Activity;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="card-surface group flex items-start gap-3 p-4 transition-all duration-150 hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-lift"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600 ring-1 ring-primary-100 transition-colors group-hover:bg-primary-500 group-hover:text-white">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-sm font-semibold text-slate-900">
          {title}
          <ArrowRight className="h-3.5 w-3.5 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-primary-600" />
        </span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>
      </span>
    </Link>
  );
}
