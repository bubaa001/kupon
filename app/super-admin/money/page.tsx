'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn, formatTZS } from '@/lib/utils';
import { useApiData } from '../_components/use-api-data';

type MoneyData = {
  range: string;
  includeTests: boolean;
  totals: {
    buyersPaid: number;
    snippeCollections: number;
    kuponOrderFees: number;
    cafeteriaEarnings: number;
    orders: number;
    testOrders: number;
    payouts: number;
    paidOut: number;
    snippePayoutFees: number;
    kuponPayoutFees: number;
    kuponEarned: number;
    snippeEarned: number;
    cafeteriaBalances: number;
  };
  cafeterias: Array<{
    id: string;
    name: string;
    code: string;
    campus: string;
    status: string;
    balance: number;
    orders: number;
    sales: number;
    kupon: number;
    snippe: number;
    paidOut: number;
  }>;
};

const RANGES = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All time' },
];

/** Kupon's money view: where every shilling paid by buyers ended up. */
export default function MoneyPage() {
  const [range, setRange] = useState('30d');
  const [tests, setTests] = useState(true);
  const { data, error, loading } = useApiData<MoneyData>(
    `/api/super-admin/money?range=${range}&tests=${tests ? 1 : 0}`,
  );
  const t = data?.totals;
  const split = t && t.buyersPaid > 0
    ? [
        { label: 'Cafeterias', value: t.cafeteriaEarnings, className: 'bg-navy' },
        { label: 'Snippe', value: t.snippeCollections, className: 'bg-navy-300' },
        { label: 'Kupon', value: t.kuponOrderFees, className: 'bg-gold' },
      ]
    : [];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Platform"
        title="Money"
        description="What buyers paid, what Snippe kept, what Kupon earned and what cafeterias are owed."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-navy/15 bg-white p-0.5" role="group" aria-label="Period">
          {RANGES.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
              className={cn(
                'min-h-9 rounded-full px-3.5 text-sm font-medium',
                range === option.key ? 'bg-navy text-white' : 'text-navy hover:bg-navy-50',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex min-h-9 items-center gap-2 rounded-full border border-navy/15 bg-white px-3.5 text-sm text-navy">
          <input type="checkbox" checked={tests} onChange={(event) => setTests(event.target.checked)} />
          Include test payments
        </label>
      </div>

      {error ? <Alert variant="danger">{error}</Alert> : null}

      {loading && !data ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[112px] rounded-2xl" />
          ))}
        </div>
      ) : t ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Big label="Kupon earned" value={t.kuponEarned} hint={`${formatTZS(t.kuponOrderFees)} orders · ${formatTZS(t.kuponPayoutFees)} withdrawals`} accent />
            <Big label="Buyers paid" value={t.buyersPaid} hint={`${t.orders} orders${t.testOrders ? ` (${t.testOrders} test)` : ''}`} />
            <Big label="Snippe earned" value={t.snippeEarned} hint={`${formatTZS(t.snippeCollections)} collections · ${formatTZS(t.snippePayoutFees)} payouts`} />
            <Big label="Owed to cafeterias" value={t.cafeteriaBalances} hint={`${formatTZS(t.paidOut)} paid out in ${t.payouts} withdrawals`} />
          </div>

          {split.length ? (
            <Card className="p-5">
              <p className="text-sm font-semibold text-navy">Where buyers&rsquo; money went</p>
              <div className="mt-3 flex h-4 w-full overflow-hidden rounded-full" aria-hidden>
                {split.map((part) => (
                  <span
                    key={part.label}
                    className={part.className}
                    style={{ width: `${Math.max(0.5, (part.value / t.buyersPaid) * 100)}%` }}
                  />
                ))}
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                {split.map((part) => (
                  <div key={part.label}>
                    <dt className="flex items-center gap-1.5 text-xs text-ink-muted">
                      <span className={cn('h-2.5 w-2.5 rounded-full', part.className)} aria-hidden />
                      {part.label}
                    </dt>
                    <dd className="font-semibold tabular text-navy">
                      {formatTZS(part.value)}{' '}
                      <span className="text-xs font-normal text-ink-muted">
                        {((part.value / t.buyersPaid) * 100).toFixed(1)}%
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card className="p-0">
            <div className="p-5 pb-3">
              <p className="text-sm font-semibold text-navy">By cafeteria</p>
              <p className="text-xs text-ink-muted">Sorted by sales in this period.</p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cafeteria</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Sales (TZS)</TableHead>
                  <TableHead className="text-right">Kupon (TZS)</TableHead>
                  <TableHead className="text-right">Snippe (TZS)</TableHead>
                  <TableHead className="text-right">Paid out (TZS)</TableHead>
                  <TableHead className="text-right">Balance (TZS)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.cafeterias.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-ink-muted">
                      No cafeterias yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.cafeterias.map((cafe) => (
                    <TableRow key={cafe.id}>
                      <TableCell>
                        <span className="font-semibold text-navy">{cafe.name}</span>
                        <span className="ml-2 text-xs text-ink-muted">{cafe.campus}</span>
                        {cafe.status !== 'ACTIVE' ? (
                          <Badge variant="neutral" className="ml-2">
                            {cafe.status.toLowerCase()}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right tabular">{cafe.orders}</TableCell>
                      <TableCell className="text-right tabular">{cafe.sales.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right tabular font-semibold text-navy">{cafe.kupon.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right tabular">{cafe.snippe.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right tabular">{cafe.paidOut.toLocaleString('en-US')}</TableCell>
                      <TableCell className="text-right tabular">{cafe.balance.toLocaleString('en-US')}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function Big({ label, value, hint, accent }: { label: string; value: number; hint: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border p-4', accent ? 'border-gold bg-gold-50' : 'border-navy/[0.09] bg-white')}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-muted">{label}</p>
      <p className="mt-2 text-xl font-medium tracking-[-0.03em] tabular text-navy sm:text-2xl">{formatTZS(value)}</p>
      <p className="mt-1 text-[11px] leading-snug text-ink-muted">{hint}</p>
    </div>
  );
}
