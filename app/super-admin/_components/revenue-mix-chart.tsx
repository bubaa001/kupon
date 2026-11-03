'use client';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactTZS, formatTZS } from '@/lib/utils';
import type { MonthPoint } from './types';

/**
 * Six-month platform revenue mix: grouped bars for fee revenue and collected
 * SaaS, with GMV on a secondary axis so volume and monetisation stay readable
 * on a phone-sized chart.
 */
export function RevenueMixChart({ data, height = 300 }: { data: MonthPoint[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, left: -14, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#E2E8F0" strokeDasharray="4 5" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11, fontWeight: 500 }}
            dy={10}
          />
          <YAxis
            yAxisId="left"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(value: number) => formatCompactTZS(value).replace('TZS ', '')}
            width={52}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(value: number) => formatCompactTZS(value).replace('TZS ', '')}
            width={52}
          />
          <Tooltip
            cursor={{ fill: '#F1F5F9' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid #E2E8F0',
              boxShadow: '0 12px 32px -12px rgb(15 23 42 / 0.22)',
              fontSize: 12,
            }}
            formatter={(value, name) => [formatTZS(Number(value)), String(name)]}
            labelFormatter={(label) => String(label)}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
            iconType="circle"
            iconSize={8}
          />
          <Bar
            yAxisId="left"
            dataKey="platformFee"
            name="Platform fees"
            fill="#10B981"
            radius={[6, 6, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
          <Bar
            yAxisId="left"
            dataKey="saasCollected"
            name="SaaS collected"
            fill="#0F172A"
            radius={[6, 6, 0, 0]}
            maxBarSize={26}
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="gmv"
            name="GMV"
            stroke="#0EA5E9"
            strokeWidth={2.2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff', fill: '#0EA5E9' }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
