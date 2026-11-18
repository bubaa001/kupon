import { z } from 'zod';

/**
 * Cafeteria opening hours, in Tanzania time (UTC+3, no daylight saving).
 * Both times null = no hours set: the cafeteria is treated as always open and
 * coupons keep their plain 24-hour life.
 */
export type CafeteriaHours = { openTime: string | null; closeTime: string | null };

const TZ_OFFSET_MINUTES = 3 * 60;
const DAY = 24 * 60;

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a time like 07:30.');

export const cafeteriaHoursSchema = z
  .object({ openTime: hhmm.nullable(), closeTime: hhmm.nullable() })
  .strict()
  .refine((value) => (value.openTime === null) === (value.closeTime === null), {
    message: 'Set both opening and closing times, or clear both.',
  })
  .refine((value) => value.openTime === null || value.openTime !== value.closeTime, {
    message: 'Opening and closing times must be different.',
  });

function toMinutes(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function localMinutes(now: Date): number {
  return (now.getUTCHours() * 60 + now.getUTCMinutes() + TZ_OFFSET_MINUTES) % DAY;
}

function hasHours(hours: CafeteriaHours): hours is { openTime: string; closeTime: string } {
  return Boolean(hours.openTime && hours.closeTime && hours.openTime !== hours.closeTime);
}

/** True when the cafeteria is open at `now` (always true when no hours are set). */
export function isCafeteriaOpen(hours: CafeteriaHours, now = new Date()): boolean {
  if (!hasHours(hours)) return true;
  const open = toMinutes(hours.openTime);
  const close = toMinutes(hours.closeTime);
  const t = localMinutes(now);
  return open < close ? t >= open && t < close : t >= open || t < close;
}

/**
 * The next closing moment: today's close while open, or the close of the next
 * opening period while closed (so a late payment confirmation is never
 * forfeited at once). Null when no hours are set.
 */
export function nextClosingTime(hours: CafeteriaHours, now = new Date()): Date | null {
  if (!hasHours(hours)) return null;
  const open = toMinutes(hours.openTime);
  const close = toMinutes(hours.closeTime);
  const t = localMinutes(now);
  let minutesAhead: number;
  if (isCafeteriaOpen(hours, now)) {
    minutesAhead = (close - t + DAY) % DAY || DAY;
  } else {
    minutesAhead = ((open - t + DAY) % DAY) + ((close - open + DAY) % DAY);
  }
  const startOfMinute = Math.floor(now.getTime() / 60_000) * 60_000;
  return new Date(startOfMinute + minutesAhead * 60_000);
}

/** Caps a deadline at closing time. `byClosing` says the closing time won. */
export function capAtClosing(
  hours: CafeteriaHours,
  deadline: Date,
  now = new Date(),
): { expiresAt: Date; byClosing: boolean } {
  const closing = nextClosingTime(hours, now);
  if (closing && closing < deadline) return { expiresAt: closing, byClosing: true };
  return { expiresAt: deadline, byClosing: false };
}

/** "07:00 – 18:00", or null when no hours are set. */
export function formatHours(hours: CafeteriaHours): string | null {
  return hasHours(hours) ? `${hours.openTime} – ${hours.closeTime}` : null;
}

/** "18:00" in Tanzania time for a closing instant. */
export function formatTanzaniaTime(date: Date): string {
  const t = localMinutes(date);
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export const CLOSING_EXPIRY = 'CLOSING';
