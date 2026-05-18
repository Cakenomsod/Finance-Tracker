import { Timestamp } from 'firebase/firestore';
import { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { TripExpense, TripCurrency } from '@/lib/firestore-types';

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

export function receiptParseToTripExpenseDraft(
  parsed: ReceiptParseResult,
  tripMembers: { key: string; displayName: string }[],
  defaultCurrency?: TripCurrency
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
    date: Timestamp.fromDate(new Date(parsed.date)),
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
