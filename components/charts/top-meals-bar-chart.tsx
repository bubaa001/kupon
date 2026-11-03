'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCompactTZS, formatTZS } from '@/lib/utils';

export type TopMeal = {
  name: string;
  orders: number;
  revenue: number;
  emoji?: string;
};

const COLORS = ['#10B981', '#34D399', '#6EE7B7', '#A7F3D0', '#D1FAE5'];

function MealTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: TopMeal; value?: number }>;
}) {
  if (!active || !payload?.length) return null;
  const meal = payload[0]?.payload;
  if (!meal) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-lift">
      <p className="text-xs font-semibold text-slate-900">{meal.name}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-700">{formatTZS(meal.revenue)}</p>
      <p className="text-[11px] text-slate-500">{meal.orders} orders</p>
    </div>
  );
}

export function TopMealsBarChart({ data, height = 280 }: { data: TopMeal[]; height?: number }) {
  return (
    <div style={{ width: '100%', height }} className="min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="#E2E8F0" strokeDasharray="4 5" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#94A3B8', fontSize: 11 }}
            tickFormatter={(value: number) => formatCompactTZS(value).replace('TZS ', '')}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tickLine={false}
            axisLine={false}
            tick={{ fill: '#475569', fontSize: 11, fontWeight: 500 }}
          />
          <Tooltip content={<MealTooltip />} cursor={{ fill: '#F8FAFC' }} />
          <Bar dataKey="revenue" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
