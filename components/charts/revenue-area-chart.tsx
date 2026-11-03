'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactTZS, formatTZS } from '@/lib/utils';

export type RevenuePoint = {
  date: string;
  label: string;
  revenue: number;
  transactions?: number;
  profit?: number;
};

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string; payload?: RevenuePoint }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lift">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">
        {formatTZS(Number(payload[0]?.value ?? 0))}
      </p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {point?.transactions ?? 0} transactions
      </p>
      {typeof point?.profit === 'number' ? (
        <p className="mt-1 text-[11px] font-medium text-emerald-700">
          Net profit {formatTZS(point.profit)}
        </p>
      ) : null}
    </div>
  );
}

export function RevenueAreaChart({
  data,
  height = 280,
  showProfit = false,
}: {
  data: RevenuePoint[];
  height?: number;
  showProfit?: boolean;
}) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
              <stop offset="70%" stopColor="#10B981" stopOpacity={0.06} />
              <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="profitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0F172A" stopOpacity={0.16} />
              <stop offset="100%" stopColor="#0F172A" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
            dy={10}
            minTickGap={16}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(value: number) => formatCompactTZS(value).replace('TZS ', '')}
            width={52}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#10B981"
            strokeWidth={2.4}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff', fill: '#10B981' }}
            dot={false}
          />
          {showProfit ? (
            <Area
              type="monotone"
              dataKey="profit"
              stroke="#0F172A"
              strokeWidth={1.6}
              fill="url(#profitFill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#0F172A' }}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
