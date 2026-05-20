import { ReceiptParseResult } from '@/lib/ai/receipt-schema';

const VALID_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
];

/** item name + amount: "ไก่ทอด 20", "coffee 45 baht" */
const ITEM_PATTERN =
  /([^\d,]+?)\s*(\d+(?:\.\d+)?)\s*(?:บาท|บ|฿|baht)?(?=\s|$|[,،])/gi;

/** amount + item: "20บาท ขนม", "45 กาแฟ" */
const AMOUNT_FIRST_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:บาท|บ|฿|baht)?\s*([^\d,]+?)(?=\s|$|[,،])/gi;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  if (/กาแฟ|coffee|ชา|tea|อาหาร|ข้าว|ทอด|ก๋วย|noodle|food|eat|meal|snack|drink|น้ำ/.test(n)) {
    return 'Food & Dining';
  }
  if (/แท็กซี่|taxi|grab|รถ|bus|bts|mrt|transport|เดินทาง/.test(n)) {
    return 'Transport';
  }
  return 'Food & Dining';
}

/**
 * Fast local parse for simple notes like "ไก่ทอด 20" or "ไก่ทอด 20 กาแฟ 45".
 * Returns null if the text does not look like expense items.
 */
/** "ไก่ทอด20" → "ไก่ทอด 20", "20บาท" stays readable */
function normalizeExpenseInput(text: string): string {
  return text
    .replace(/([^\d\s])(\d)/g, '$1 $2')
    .replace(/(\d)([^\d\s.,บ฿])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tryParseExpenseTextHeuristic(
  text: string,
  defaultCurrency: 'THB' | 'JPY' = 'THB'
): ReceiptParseResult | null {
  const trimmed = normalizeExpenseInput(text);
  if (!trimmed || trimmed.length > 500) return null;

  const items: Array<{ name: string; category: string; price: number }> = [];

  function pushItem(nameRaw: string, priceRaw: string) {
    const name = nameRaw.trim().replace(/^[,،\s]+|[,،\s]+$/g, '');
    const price = parseFloat(priceRaw);
    if (!name || name.length < 1 || !Number.isFinite(price) || price <= 0) return;
    items.push({
      name,
      category: guessCategory(name),
      price,
    });
  }

  let match: RegExpExecArray | null;

  ITEM_PATTERN.lastIndex = 0;
  while ((match = ITEM_PATTERN.exec(trimmed)) !== null) {
    pushItem(match[1], match[2]);
  }

  if (items.length === 0) {
    AMOUNT_FIRST_PATTERN.lastIndex = 0;
    while ((match = AMOUNT_FIRST_PATTERN.exec(trimmed)) !== null) {
      pushItem(match[2], match[1]);
    }
  }

  if (items.length === 0) return null;

  const totalAmount = items.reduce((s, i) => s + i.price, 0);
  const description =
    items.length === 1 ? items[0].name : items.map((i) => i.name).join(', ');

  return {
    documentType: 'receipt',
    description,
    category: items.length === 1 ? items[0].category : 'Food & Dining',
    date: todayIso(),
    totalAmount,
    currency: defaultCurrency,
    items: items.length > 1 ? items : undefined,
  };
}
