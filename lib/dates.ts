import {
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
} from 'date-fns';

export type RangeKey = 'today' | '7d' | '30d' | 'mtd';

export function getRange(key: RangeKey) {
  const now = new Date();
  switch (key) {
    case 'today':
      return {
        label: 'Today',
        start: startOfDay(now),
        end: endOfDay(now),
        days: 1,
        groupBy: 'hour' as const,
      };
    case '30d':
      return {
        label: 'Last 30 days',
        start: startOfDay(subDays(now, 29)),
        end: endOfDay(now),
        days: 30,
        groupBy: 'day' as const,
      };
    case 'mtd':
      return {
        label: 'This month',
        start: startOfMonth(now),
        end: endOfDay(now),
        days: now.getDate(),
        groupBy: 'day' as const,
      };
    case '7d':
    default:
      return {
        label: 'Last 7 days',
        start: startOfDay(subDays(now, 6)),
        end: endOfDay(now),
        days: 7,
        groupBy: 'day' as const,
      };
  }
}

export function getLastNDays(n: number) {
  const end = endOfDay(new Date());
  const start = startOfDay(subDays(new Date(), n - 1));
  return eachDayOfInterval({ start, end });
}

export function dayKey(value: Date | string) {
  return format(new Date(value), 'yyyy-MM-dd');
}

export function dayLabel(value: Date | string) {
  return format(new Date(value), 'EEE');
}

export function monthLabel(value: Date | Date[] | string) {
  return format(Array.isArray(value) ? value[0] : new Date(value), 'MMM');
}
