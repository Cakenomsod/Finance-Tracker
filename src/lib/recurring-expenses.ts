import { Timestamp } from 'firebase/firestore';
import type { AppLocale } from '@/lib/locale';
import type { RecurringExpense, RecurringFrequencyUnit } from '@/lib/firestore-types';
import { toDateFromFirestore } from '@/lib/datetime';

export function normalizeFrequencyInterval(interval?: number): number {
  const value = Number(interval);
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.floor(value);
}

export function advanceRecurringDate(
  date: Date,
  interval: number,
  unit: RecurringFrequencyUnit
): Date {
  const next = new Date(date);
  const step = normalizeFrequencyInterval(interval);

  switch (unit) {
    case 'daily':
      next.setDate(next.getDate() + step);
      break;
    case 'weekly':
      next.setDate(next.getDate() + step * 7);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + step);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + step);
      break;
  }

  return next;
}

export function startOfLocalDay(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getRecurringDueDate(expense: RecurringExpense): Date | null {
  return toDateFromFirestore(expense.nextDate);
}

export function isRecurringDue(expense: RecurringExpense, referenceDate: Date = new Date()): boolean {
  const dueDate = getRecurringDueDate(expense);
  if (!dueDate) return false;
  return startOfLocalDay(dueDate).getTime() <= startOfLocalDay(referenceDate).getTime();
}

export function getDueRecurringExpenses(
  expenses: RecurringExpense[],
  referenceDate: Date = new Date()
): RecurringExpense[] {
  return expenses
    .filter((expense) => isRecurringDue(expense, referenceDate))
    .sort((a, b) => (a.nextDate?.seconds ?? 0) - (b.nextDate?.seconds ?? 0));
}

export function formatFrequencyLabel(
  interval: number | undefined,
  unit: RecurringFrequencyUnit,
  locale: AppLocale
): string {
  const step = normalizeFrequencyInterval(interval);
  const isTh = locale === 'th';

  const unitLabels: Record<RecurringFrequencyUnit, { one: string; many: string }> = isTh
    ? {
        daily: { one: 'วัน', many: 'วัน' },
        weekly: { one: 'สัปดาห์', many: 'สัปดาห์' },
        monthly: { one: 'เดือน', many: 'เดือน' },
        yearly: { one: 'ปี', many: 'ปี' },
      }
    : {
        daily: { one: 'day', many: 'days' },
        weekly: { one: 'week', many: 'weeks' },
        monthly: { one: 'month', many: 'months' },
        yearly: { one: 'year', many: 'years' },
      };

  const labels = unitLabels[unit];
  const unitText = step === 1 ? labels.one : labels.many;

  if (isTh) {
    return step === 1 ? `ทุก${unitText}` : `ทุก ${step} ${unitText}`;
  }

  return step === 1 ? `Every ${unitText}` : `Every ${step} ${unitText}`;
}

export function recurringSnoozeKey(expenseId: string, dueDate: Date): string {
  return `recurring-snooze:${expenseId}:${formatLocalDateKey(dueDate)}`;
}

function formatLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isRecurringSnoozed(expense: RecurringExpense): boolean {
  if (typeof window === 'undefined' || !expense.id) return false;
  const dueDate = getRecurringDueDate(expense);
  if (!dueDate) return false;
  return localStorage.getItem(recurringSnoozeKey(expense.id, dueDate)) === '1';
}

export function snoozeRecurring(expense: RecurringExpense): void {
  if (typeof window === 'undefined' || !expense.id) return;
  const dueDate = getRecurringDueDate(expense);
  if (!dueDate) return;
  localStorage.setItem(recurringSnoozeKey(expense.id, dueDate), '1');
}

export function getVisibleDueRecurringExpenses(
  expenses: RecurringExpense[],
  referenceDate: Date = new Date()
): RecurringExpense[] {
  return getDueRecurringExpenses(expenses, referenceDate).filter(
    (expense) => !isRecurringSnoozed(expense)
  );
}

export function toRecurringTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}
