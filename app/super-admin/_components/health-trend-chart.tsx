'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@/lib/utils';
import type { HealthTrendPoint } from './types';

/** Stacked settled vs failed payment attempts for the last seven days. */
export function HealthTrendChart({
  data,
  height = 220,
}: {
  data: HealthTrendPoint[];
  height?: number;
}) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
            dy={8}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(value: number) => formatNumber(value)}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 32px -12px rgb(15 23 42 / 0.22)',
              fontSize: 12,
            }}
            formatter={(value, name) => [formatNumber(Number(value)), String(name)]}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            dataKey="settled"
            name="Settled payments"
            stackId="payments"
            fill="#10B981"
            maxBarSize={30}
            isAnimationActive={false}
          />
          <Bar
            dataKey="failed"
            name="Failed payments"
            stackId="payments"
            fill="#EF4444"
            radius={[6, 6, 0, 0]}
            maxBarSize={30}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
