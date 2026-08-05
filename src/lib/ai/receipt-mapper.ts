import { Timestamp } from 'firebase/firestore';
import { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { normalizeAiDate, normalizeAiTime } from '@/lib/ai/ai-datetime';
import { parseLocalDateTime } from '@/lib/datetime';
import { parseTripLocalDateTime } from '@/lib/trip-currency';
import { TripExpense, TripCurrency, Transaction, TripExpensePayer, TripExpenseShare } from '@/lib/firestore-types';
import { ME_PERSON_ID, TransactionSplitMode } from '@/lib/transaction-split';

const VALID_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
];

function normalizeCategory(cat: string, fallback = 'Shopping'): string {
  const trimmed = cat.trim();
  if (!trimmed) return fallback;
  const match = VALID_CATEGORIES.find(
    (c) =>
      c.toLowerCase() === trimmed.toLowerCase() ||
      c.includes(trimmed) ||
      trimmed.includes(c.split(' ')[0])
  );
  return match || fallback;
}

/** Main + line-item categories for receipt drafts (Shopping soft-default; items inherit main). */
function resolveDraftCategories(parsed: ReceiptParseResult): {
  category: string;
  itemCategory: (raw: string | undefined) => string;
} {
  const mainFallback = parsed.documentType === 'transfer_slip' ? 'Others' : 'Shopping';
  const category = normalizeCategory(parsed.category ?? '', mainFallback);
  return {
    category,
    itemCategory: (raw) => {
      const trimmed = (raw ?? '').trim();
      if (!trimmed) return category;
      return normalizeCategory(trimmed, category);
    },
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function personIdFromName(name: string): string {
  return name === 'Me' ? ME_PERSON_ID : name;
}

function toPayerRow(name: string, amount: number): TripExpensePayer {
  const id = personIdFromName(name);
  return { userId: id, displayName: id === ME_PERSON_ID ? 'Me' : name, amount };
}

function toShareRow(name: string, amount: number): TripExpenseShare {
  const id = personIdFromName(name);
  return { userId: id, displayName: id === ME_PERSON_ID ? 'Me' : name, amount };
}

interface ParsedSplit {
  payers: TripExpensePayer[];
  shares: TripExpenseShare[];
  splitMode: TransactionSplitMode;
  paidBy: string;
}

function buildSplitFromParsed(parsed: ReceiptParseResult): ParsedSplit | null {
  const total = parsed.totalAmount;
  const hasPayers = (parsed.payers?.length ?? 0) > 0;
  const hasShares = (parsed.shares?.length ?? 0) > 0;
  const mode = parsed.splitMode;

  if (!hasPayers && !hasShares && !mode) return null;

  let payers = hasPayers ? parsed.payers!.map((p) => toPayerRow(p.name, p.amount)) : [];
  let shares = hasShares ? parsed.shares!.map((s) => toShareRow(s.name, s.amount)) : [];
  let splitMode: TransactionSplitMode = mode === 'custom' ? 'custom' : mode === 'solo' ? 'solo' : 'equal';

  if (!payers.length) {
    payers = [{ userId: ME_PERSON_ID, displayName: 'Me', amount: total }];
  }

  if (!shares.length && splitMode === 'equal') {
    const people = new Set<string>();
    for (const p of parsed.payers ?? []) people.add(p.name);
    if (people.size === 0) people.add('Me');
    const names = [...people];
    const each = roundMoney(total / names.length);
    shares = names.map((name, i) => {
      const amt = i === names.length - 1 ? roundMoney(total - each * (names.length - 1)) : each;
      return toShareRow(name, amt);
    });
  }

  if (!shares.length) {
    shares = [{ userId: ME_PERSON_ID, displayName: 'Me', amount: total }];
    splitMode = 'solo';
  }

  if (shares.length === 1 && payers.length === 1 && splitMode === 'equal') {
    splitMode = 'solo';
  }

  const topPayer = [...payers].sort((a, b) => b.amount - a.amount)[0];
  const paidBy = topPayer?.displayName || ME_PERSON_ID;

  return { payers, shares, splitMode, paidBy };
}

function tripMemberKeyForName(
  name: string,
  tripMembers: { key: string; displayName: string }[],
  selfUserId?: string
): string {
  if (name === 'Me' || name === ME_PERSON_ID) {
    return selfUserId || tripMembers[0]?.key || ME_PERSON_ID;
  }
  const hit = tripMembers.find(
    (m) => m.displayName.toLowerCase() === name.toLowerCase() || m.key === name
  );
  return hit?.key ?? name;
}

function mapSplitToTripMembers(
  split: ParsedSplit,
  tripMembers: { key: string; displayName: string }[],
  selfUserId?: string
): ParsedSplit {
  const mapPayer = (p: TripExpensePayer): TripExpensePayer => {
    const key = tripMemberKeyForName(p.displayName, tripMembers, selfUserId);
    const member = tripMembers.find((m) => m.key === key);
    return { userId: key, displayName: member?.displayName || p.displayName, amount: p.amount };
  };
  const mapShare = (s: TripExpenseShare): TripExpenseShare => {
    const key = tripMemberKeyForName(s.displayName, tripMembers, selfUserId);
    const member = tripMembers.find((m) => m.key === key);
    return { userId: key, displayName: member?.displayName || s.displayName, amount: s.amount };
  };
  return {
    ...split,
    payers: split.payers.map(mapPayer),
    shares: split.shares.map(mapShare),
    paidBy: mapPayer({ userId: split.paidBy, displayName: split.paidBy, amount: 0 }).displayName,
  };
}

function toFirestoreDate(parsed: ReceiptParseResult, timeZone?: string | null): Date {
  const date = normalizeAiDate(parsed.date, timeZone ?? undefined);
  const time = normalizeAiTime(parsed.time, timeZone ?? undefined);
  if (timeZone) {
    return parseTripLocalDateTime(date, time, timeZone);
  }
  return parseLocalDateTime(date, time);
}

export { normalizeAiDate, normalizeAiTime } from '@/lib/ai/ai-datetime';

export function receiptParseToTripExpenseDraft(
  parsed: ReceiptParseResult,
  tripMembers: { key: string; displayName: string }[],
  defaultCurrency?: TripCurrency,
  timeZone?: string | null,
  selfUserId?: string
): Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'> {
  const memberKeys = tripMembers.map((m) => m.key);
  const primaryMember = tripMembers[0];
  const currency = parsed.currency || defaultCurrency || 'THB';
  const hasItems = parsed.items && parsed.items.length > 0;
  const { category, itemCategory } = resolveDraftCategories(parsed);

  const parsedSplit = buildSplitFromParsed(parsed);
  const split = parsedSplit
    ? mapSplitToTripMembers(parsedSplit, tripMembers, selfUserId)
    : null;

  const items = hasItems
    ? parsed.items!.map((item) => ({
        name: item.name,
        category: itemCategory(item.category),
        price: item.price,
        tax: item.tax ?? 0,
        splitWith: memberKeys,
        taxCategoryId: item.taxCategoryId,
      }))
    : undefined;

  const defaultPayers: TripExpensePayer[] = [
    {
      userId: primaryMember?.key || memberKeys[0] || '',
      displayName: primaryMember?.displayName || 'Me',
      amount: parsed.totalAmount,
    },
  ];
  const defaultShares: TripExpenseShare[] = tripMembers.map((m) => ({
    userId: m.key,
    displayName: m.displayName,
    amount: parseFloat((parsed.totalAmount / tripMembers.length).toFixed(2)),
  }));

  return {
    description: parsed.description,
    totalAmount: parsed.totalAmount,
    category,
    date: Timestamp.fromDate(toFirestoreDate(parsed, timeZone)),
    splitMode: split?.splitMode ?? (hasItems ? 'item' : 'equal'),
    payers: split?.payers ?? defaultPayers,
    shares: split?.shares ?? defaultShares,
    items,
    baseAmount: parsed.baseAmount,
    taxAmount: parsed.taxAmount,
    ...(parsed.discount && parsed.discount > 0 ? { discount: parsed.discount } : {}),
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
  const split = buildSplitFromParsed(parsed);
  const { category, itemCategory } = resolveDraftCategories(parsed);

  const items = hasItems
    ? parsed.items!.map((item) => ({
        name: item.name,
        category: itemCategory(item.category),
        price: item.price,
        tax: item.tax ?? 0,
        splitWith: [] as string[],
        taxCategoryId: item.taxCategoryId,
      }))
    : undefined;

  const debtTracking =
    parsed.debtTracking !== undefined
      ? parsed.debtTracking
      : split
        ? split.payers.some((p) => p.userId !== ME_PERSON_ID) ||
          split.shares.some((s) => s.userId !== ME_PERSON_ID)
        : undefined;

  return {
    amount: -Math.abs(parsed.totalAmount),
    type: 'expense',
    category,
    description: parsed.description,
    date: Timestamp.fromDate(toFirestoreDate(parsed)),
    items,
    baseAmount: parsed.baseAmount,
    taxAmount: parsed.taxAmount,
    discount: parsed.discount,
    receiptUrl: null,
    source: 'ai',
    currency,
    paidBy: split?.paidBy ?? 'Me',
    splitWith: null,
    payers: split?.payers,
    shares: split?.shares,
    splitMode: split?.splitMode,
    paymentMethod: parsed.paymentMethod,
    debtTracking,
    tripId: null,
  };
}
