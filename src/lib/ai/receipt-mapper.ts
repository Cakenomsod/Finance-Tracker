import { Timestamp } from 'firebase/firestore';
import { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { parseLocalDateTime } from '@/lib/datetime';
import { parseTripLocalDateTime } from '@/lib/trip-currency';
import { TripExpense, TripCurrency, Transaction } from '@/lib/firestore-types';

const VALID_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
];

function normalizeCategory(cat: string): string {
  const match = VALID_CATEGORIES.find(
    (c) => c.toLowerCase() === cat.toLowerCase() || c.includes(cat) || cat.includes(c.split(' ')[0])
  );
  return match || 'Others';
}

/** Normalize AI time output to HH:mm for form inputs; null if not provided */
export function normalizeAiTime(time?: string): string | null {
  if (!time?.trim()) return null;

  const t = time.trim();

  const ampm = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    if (ampm[3].toLowerCase() === 'pm' && h < 12) h += 12;
    if (ampm[3].toLowerCase() === 'am' && h === 12) h = 0;
    return `${String(Math.min(23, h)).padStart(2, '0')}:${m}`;
  }

  const hms = t.match(/^(\d{1,2}):(\d{2})/);
  if (hms) {
    return `${String(Math.min(23, parseInt(hms[1], 10))).padStart(2, '0')}:${hms[2]}`;
  }

  return null;
}

function toFirestoreDate(parsed: ReceiptParseResult, timeZone?: string | null): Date {
  const time = normalizeAiTime(parsed.time) ?? '12:00';
  if (timeZone) {
    return parseTripLocalDateTime(parsed.date, time, timeZone);
  }
  return parseLocalDateTime(parsed.date, time);
}

export function receiptParseToTripExpenseDraft(
  parsed: ReceiptParseResult,
  tripMembers: { key: string; displayName: string }[],
  defaultCurrency?: TripCurrency,
  timeZone?: string | null
): Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'> {
  const memberKeys = tripMembers.map((m) => m.key);
  const primaryMember = tripMembers[0];
  const currency = parsed.currency || defaultCurrency || 'THB';
  const hasItems = parsed.items && parsed.items.length > 0;

  const items = hasItems
    ? parsed.items!.map((item) => ({
        name: item.name,
        category: normalizeCategory(item.category),
        price: item.price,
        tax: item.tax ?? 0,
        splitWith: memberKeys,
        taxCategoryId: item.taxCategoryId,
      }))
    : undefined;

  return {
    description: parsed.description,
    totalAmount: parsed.totalAmount,
    category: normalizeCategory(parsed.category),
    date: Timestamp.fromDate(toFirestoreDate(parsed, timeZone)),
    splitMode: hasItems ? 'item' : 'equal',
    payers: [
      {
        userId: primaryMember?.key || memberKeys[0] || '',
        displayName: primaryMember?.displayName || 'Me',
        amount: parsed.totalAmount,
      },
    ],
    shares: tripMembers.map((m) => ({
      userId: m.key,
      displayName: m.displayName,
      amount: parseFloat((parsed.totalAmount / tripMembers.length).toFixed(2)),
    })),
    items,
    baseAmount: parsed.baseAmount,
    taxAmount: parsed.taxAmount,
    taxMode: parsed.taxMode,
    currency,
    source: 'ai',
  };
}

export function receiptParseToTransactionDraft(
  parsed: ReceiptParseResult,
  defaultCurrency: 'THB' | 'JPY' = 'THB'
): Omit<Transaction, 'id' | 'createdAt' | 'userId'> {
  const currency = parsed.currency || defaultCurrency;
  const hasItems = parsed.items && parsed.items.length > 0;

  const items = hasItems
    ? parsed.items!.map((item) => ({
        name: item.name,
        category: normalizeCategory(item.category),
        price: item.price,
        tax: item.tax ?? 0,
        splitWith: [] as string[],
        taxCategoryId: item.taxCategoryId,
      }))
    : undefined;

  return {
    amount: -Math.abs(parsed.totalAmount), // negative for expense
    type: 'expense',
    category: normalizeCategory(parsed.category),
    description: parsed.description,
    date: Timestamp.fromDate(toFirestoreDate(parsed)),
    items,
    baseAmount: parsed.baseAmount,
    taxAmount: parsed.taxAmount,
    receiptUrl: null,
    source: 'ai',
    currency,
    paidBy: 'Me',
    splitWith: null,
    tripId: null,
  };
}
