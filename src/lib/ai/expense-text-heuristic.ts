import { ReceiptParseResult } from '@/lib/ai/receipt-schema';

const VALID_CATEGORIES = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
];

/** Strict simple format: "รายการ 20", "coffee 45 baht" */
const SIMPLE_NAME_AMOUNT_PATTERN =
  /^([^\d,]+?)\s+(\d+(?:\.\d+)?)\s*(?:บาท|บ|฿|baht)?$/i;

/** Strict simple format (amount first): "20บาท ขนม", "45 coffee" */
const SIMPLE_AMOUNT_NAME_PATTERN =
  /^(\d+(?:\.\d+)?)\s*(?:บาท|บ|฿|baht)?\s+([^\d,]+?)$/i;

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
 * Stage-1 detector:
 * accept only short, strict, one-item formats. Complex sentences must go to AI.
 */
/** "ไก่ทอด20" → "ไก่ทอด 20", "20บาท" stays readable */
function normalizeExpenseInput(text: string): string {
  return text
    .replace(/([^\d\s])(\d)/g, '$1 $2')
    .replace(/(\d)([^\d\s.,บ฿])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tryParseExpenseTextStrictFormat(
  text: string,
  defaultCurrency: 'THB' | 'JPY' = 'THB'
): ReceiptParseResult | null {
  const trimmed = normalizeExpenseInput(text);
  if (!trimmed || trimmed.length > 80) return null;
  if (/ครับ|ค่ะ|ช่วย|ฝาก|แล้ว|ที่ร้าน|หน่อย|ให้|เพื่อน|เมื่อ|ตอน|พรุ่งนี้|เมื่อวาน/.test(trimmed)) {
    return null;
  }

  const nameAmount = trimmed.match(SIMPLE_NAME_AMOUNT_PATTERN);
  const amountName = trimmed.match(SIMPLE_AMOUNT_NAME_PATTERN);
  const matched = nameAmount || amountName;
  if (!matched) return null;

  const isNameAmount = Boolean(nameAmount);
  const name = (isNameAmount ? matched[1] : matched[2]).trim().replace(/^[,،\s]+|[,،\s]+$/g, '');
  const price = parseFloat(isNameAmount ? matched[2] : matched[1]);
  if (!name || !Number.isFinite(price) || price <= 0) return null;

  return {
    documentType: 'receipt',
    description: name,
    category: guessCategory(name),
    date: todayIso(),
    totalAmount: price,
    currency: defaultCurrency,
  };
}

// Backward compatibility for existing imports.
export const tryParseExpenseTextHeuristic = tryParseExpenseTextStrictFormat;
