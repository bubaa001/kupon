import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNowStrict, isSameDay } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const tzsFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

/** Canonical currency format used everywhere in the product: `TZS 1,500`. */
export function formatTZS(amount: number | null | undefined): string {
  const value = Number(amount ?? 0);
  return `TZS ${tzsFormatter.format(Number.isFinite(value) ? value : 0)}`;
}

export function formatNumber(value: number | null | undefined): string {
  return tzsFormatter.format(Number(value ?? 0));
}

/** Compact display for stat cards: `TZS 1.24M`, `TZS 84K`. */
export function formatCompactTZS(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) return `TZS ${(amount / 1_000_000).toFixed(2)}M`;
  if (Math.abs(amount) >= 10_000) return `TZS ${Math.round(amount / 1000)}K`;
  return formatTZS(amount);
}

export function formatDate(value: string | Date, pattern = 'dd MMM yyyy'): string {
  return format(new Date(value), pattern);
}

export function formatDateTime(value: string | Date): string {
  return format(new Date(value), 'dd MMM • HH:mm');
}

export function formatTime(value: string | Date): string {
  return format(new Date(value), 'HH:mm');
}

export function relativeTime(value: string | Date): string {
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function isToday(value: string | Date): boolean {
  return isSameDay(new Date(value), new Date());
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function maskPhone(phone: string | null): string {
  if (!phone) return 'Not provided';
  if (phone.length < 8) return phone;
  return `${phone.slice(0, 5)} ••• ${phone.slice(-2)}`;
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+255')) return digits;
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0')) return `+255${digits.slice(1)}`;
  if (digits.startsWith('7') || digits.startsWith('6')) return `+255${digits}`;
  return digits;
}

export function isValidTzPhone(phone: string): boolean {
  return /^\+255[67]\d{8}$/.test(normalizePhone(phone));
}

export function percentage(part: number, total: number): number {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export function safeJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function randomDigits(length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += Math.floor(Math.random() * 10);
  return out;
}

export function randomReference(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}${suffix}`;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Avoids leaking full wallet balances or phone numbers in vendor scan results. */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
