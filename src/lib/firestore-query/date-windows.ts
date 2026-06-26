import { formatLocalDateInput } from '@/lib/datetime';
import type { AnalyticsRange, DateWindow } from './types';
import type { MonthSelection } from '@/lib/datetime';

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfMonth(date: Date): Date {
  return startOfDay(new Date(date.getFullYear(), date.getMonth(), 1));
}

function endOfMonth(date: Date): Date {
  return endOfDay(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

function formatWindowLabel(start: Date, end: Date): string {
  return `${formatLocalDateInput(start)}..${formatLocalDateInput(end)}`;
}

/**
 * Latest 7 calendar days including today (today 00:00 through today 23:59:59).
 * Aligns with {@link groupItemsByDate} 7-day pagination on the Transactions page.
 */
export function buildInitial7DayWindow(): DateWindow {
  const today = new Date();
  const start = startOfDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6));
  const end = endOfDay(today);
  return { start, end, label: formatWindowLabel(start, end) };
}

/**
 * Previous 7-day window immediately before an already-loaded range.
 *
 * @param oldestLoaded Start of the oldest loaded window (typically `window.start`).
 */
export function buildOlder7DayWindow(oldestLoaded: Date): DateWindow {
  const dayBeforeOldest = new Date(oldestLoaded);
  dayBeforeOldest.setDate(dayBeforeOldest.getDate() - 1);
  const end = endOfDay(dayBeforeOldest);
  const start = startOfDay(new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6));
  return { start, end, label: formatWindowLabel(start, end) };
}

/**
 * Last 6 calendar months including the current month (e.g. Jan 1 – Jun 30 when today is in June).
 * Used for the Dashboard monthly chart initial load.
 */
export function buildInitial6MonthWindow(): DateWindow {
  const now = new Date();
  const end = endOfMonth(now);
  const start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 5, 1));
  return { start, end, label: formatWindowLabel(start, end) };
}

/**
 * Previous 6 calendar months immediately before an already-loaded chart range.
 *
 * @param before Start of the oldest loaded 6-month window.
 */
export function buildOlder6MonthWindow(before: Date): DateWindow {
  const priorMonthStart = new Date(before.getFullYear(), before.getMonth() - 1, 1);
  const end = endOfMonth(priorMonthStart);
  const start = startOfMonth(new Date(end.getFullYear(), end.getMonth() - 5, 1));
  return { start, end, label: formatWindowLabel(start, end) };
}

/** Single calendar month (inclusive start/end of month, local timezone). */
export function buildMonthWindow(year: number, month: number): DateWindow {
  const anchor = new Date(year, month, 1);
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return { start, end, label: formatWindowLabel(start, end) };
}

/**
 * Rolling date window for Analytics range dropdown values.
 * Matches {@link filterByTimeRange} in `aggregate-transactions.ts`.
 */
export function analyticsRangeToWindow(range: AnalyticsRange): DateWindow {
  const now = new Date();
  const end = endOfDay(now);
  let cutoff: Date;

  switch (range) {
    case '1month':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
    case '3months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      break;
    case '6months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      break;
    case '1year':
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      break;
    default: {
      const _exhaustive: never = range;
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      void _exhaustive;
    }
  }

  const start = startOfDay(cutoff);
  return { start, end, label: formatWindowLabel(start, end) };
}
