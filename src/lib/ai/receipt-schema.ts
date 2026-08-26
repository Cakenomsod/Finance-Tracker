import { z } from 'zod';

/** Parse messy AI number values ("1,250.00", "฿120", 120). */
function toAiNumber(val: unknown): number | undefined {
  if (val === null || val === undefined || val === '') return undefined;
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
  if (typeof val === 'string') {
    const cleaned = val.replace(/,/g, '').replace(/[^\d.-]/g, '').trim();
    if (!cleaned || cleaned === '-' || cleaned === '.') return undefined;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

const aiNumberRequired = z.preprocess((val) => {
  const n = toAiNumber(val);
  return n === undefined ? val : n;
}, z.number());

const aiNumberOptional = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  const n = toAiNumber(val);
  return n === undefined ? undefined : n;
}, z.number().optional());

const aiPositive = z.preprocess((val) => {
  const n = toAiNumber(val);
  return n === undefined ? val : n;
}, z.number().positive());

const aiNonNegative = z.preprocess((val) => {
  const n = toAiNumber(val);
  return n === undefined ? val : n;
}, z.number().nonnegative());

const aiNonNegativeOptional = z.preprocess((val) => {
  if (val === null || val === undefined || val === '') return undefined;
  const n = toAiNumber(val);
  return n === undefined ? undefined : n;
}, z.number().nonnegative().optional());

const documentTypeSchema = z.preprocess((val) => {
  if (val == null || val === '') return 'receipt';
  const s = String(val).toLowerCase().replace(/[\s-]+/g, '_');
  if (s.includes('transfer') || s.includes('slip') || s.includes('bank')) return 'transfer_slip';
  return 'receipt';
}, z.enum(['receipt', 'transfer_slip']));

/** All supported app currency codes */
const APP_CURRENCY_CODES = [
  'THB', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'AED', 'AUD', 'CAD', 'CHF',
  'DKK', 'HKD', 'INR', 'KRW', 'NOK', 'NZD', 'QAR', 'SAR', 'SEK', 'SGD', 'TWD',
] as const;

const currencySchema = z.preprocess((val) => {
  if (val == null || val === '') return undefined;
  const s = String(val).trim();
  const u = s.toUpperCase();
  const lower = s.toLowerCase();

  // Direct code match (e.g. "THB", "USD")
  if ((APP_CURRENCY_CODES as readonly string[]).includes(u)) return u;

  // Thai Baht
  if (s.includes('฿') || lower.includes('baht') || lower.includes('บาท')) return 'THB';
  // Japanese Yen / Chinese Yuan — disambiguate ¥ by context
  if (lower.includes('yuan') || lower.includes('rmb') || lower.includes('renminbi') || lower.includes('หยวน') || lower.includes('元')) return 'CNY';
  if (s.includes('¥') || lower.includes('yen') || s === '円') return 'JPY';
  // Dollar variants
  if (lower.startsWith('hk$') || lower.includes('hkd')) return 'HKD';
  if (lower.startsWith('s$') || lower.includes('sgd') || lower.includes('singapore')) return 'SGD';
  if (lower.startsWith('a$') || lower.includes('aud') || lower.includes('aussie')) return 'AUD';
  if (lower.startsWith('c$') || lower.includes('cad') || lower.includes('canadian')) return 'CAD';
  if (lower.startsWith('nz$') || lower.includes('nzd') || lower.includes('new zealand')) return 'NZD';
  if (lower.startsWith('nt$') || lower.includes('twd') || lower.includes('taiwan')) return 'TWD';
  if (s.includes('$') || lower.includes('dollar') || lower.includes('ดอล') || lower.includes('usd')) return 'USD';
  // Euro
  if (s.includes('€') || lower.includes('euro')) return 'EUR';
  // British Pound
  if (s.includes('£') || lower.includes('pound') || lower.includes('sterling') || lower.includes('gbp')) return 'GBP';
  // Indian Rupee
  if (s.includes('₹') || lower.includes('rupee') || lower.includes('inr')) return 'INR';
  // Korean Won
  if (s.includes('₩') || lower.includes('won') || lower.includes('krw')) return 'KRW';
  // Swiss Franc
  if (lower.includes('franc') || lower.includes('chf')) return 'CHF';
  // UAE Dirham
  if (lower.includes('dirham') || lower.includes('aed')) return 'AED';
  // Riyal (Qatar vs Saudi)
  if (lower.includes('riyal') || lower.includes('rial')) {
    if (lower.includes('qatar') || lower.includes('qar')) return 'QAR';
    return 'SAR';
  }
  // Scandinavian Krone/Krona
  if (lower.includes('dkk') || lower.includes('danish')) return 'DKK';
  if (lower.includes('nok') || lower.includes('norweg')) return 'NOK';
  if (lower.includes('sek') || lower.includes('swedish') || lower.includes('krona') || lower.includes('krone')) return 'SEK';

  return undefined;
}, z.enum(APP_CURRENCY_CODES).optional());

const taxModeSchema = z.preprocess((val) => {
  if (val == null || val === '') return undefined;
  const s = String(val).toLowerCase();
  if (s.includes('exclu') || s === 'added' || s === 'vat_exclusive') return 'exclusive';
  if (s.includes('inclu') || s === 'vat_inclusive') return 'inclusive';
  return undefined;
}, z.enum(['exclusive', 'inclusive']).optional());

const txTypeSchema = z.preprocess((val) => {
  if (val == null || val === '') return 'expense';
  const s = String(val).toLowerCase();
  if (s === 'income' || s.includes('รายรับ') || s.includes('เงินเข้า') || s.includes('receive')) return 'income';
  if (s === 'transfer' || s.includes('โอน') || s.includes('transfer')) return 'transfer';
  return 'expense';
}, z.enum(['income', 'expense', 'transfer']).default('expense'));

export const receiptItemSchema = z.object({
  name: z.preprocess((v) => (v == null ? '' : String(v)), z.string()),
  /** Soft default Shopping; softenReceiptPayload may override to main category first. */
  category: z.preprocess((v) => (v == null || v === '' ? 'Shopping' : String(v)), z.string()),
  price: aiNumberRequired,
  tax: aiNumberOptional,
  taxCategoryId: z.preprocess((val) => {
    if (val == null || val === '') return undefined;
    const s = String(val).toLowerCase();
    if (['food', 'goods', 'standard', 'exempt'].includes(s)) return s;
    return undefined;
  }, z.enum(['food', 'goods', 'standard', 'exempt']).optional()),
});

export const expenseSplitPersonSchema = z.object({
  name: z.preprocess((v) => (v == null ? '' : String(v)), z.string()),
  amount: aiNonNegative,
});

export const receiptParseObjectSchema = z.object({
  documentType: documentTypeSchema,
  description: z.preprocess((v) => (v == null ? '' : String(v).trim() || 'Receipt'), z.string()),
  /** Soft default Shopping for receipts; transfer slips get Others in softenReceiptPayload. */
  category: z.preprocess((v) => (v == null || v === '' ? 'Shopping' : String(v)), z.string()),
  date: z.preprocess((v) => (v == null ? '' : String(v)), z.string()),
  /** Transaction time HH:mm (24-hour), when visible on receipt/slip */
  time: z.preprocess((v) => {
    if (v == null || v === '') return undefined;
    return String(v);
  }, z.string().optional()),
  totalAmount: aiPositive,
  currency: currencySchema,
  taxMode: taxModeSchema,
  items: z.array(receiptItemSchema).optional(),
  baseAmount: aiNumberOptional,
  taxAmount: aiNumberOptional,
  discount: aiNonNegativeOptional,
  /** Expense text only — how the bill was paid */
  paymentMethod: z.preprocess((val) => {
    if (val == null || val === '') return undefined;
    const s = String(val).toLowerCase();
    if (s.includes('paotang') || s.includes('เป๋าตัง')) return 'paotang';
    if (s === 'normal') return 'normal';
    return undefined;
  }, z.enum(['normal', 'paotang']).optional()),
  /** Expense text only — track friend debts from split */
  debtTracking: z.preprocess((val) => {
    if (val == null || val === '') return undefined;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') {
      const s = val.toLowerCase();
      if (s === 'true' || s === '1' || s === 'yes') return true;
      if (s === 'false' || s === '0' || s === 'no') return false;
    }
    return undefined;
  }, z.boolean().optional()),
  /** Expense text only — equal / custom / solo split */
  splitMode: z.preprocess((val) => {
    if (val == null || val === '') return undefined;
    const s = String(val).toLowerCase();
    if (s === 'equal' || s === 'custom' || s === 'solo') return s;
    return undefined;
  }, z.enum(['equal', 'custom', 'solo']).optional()),
  /** Who paid (names as spoken; resolved server-side) */
  payers: z.array(expenseSplitPersonSchema).optional(),
  /** Who owes shares of the bill */
  shares: z.array(expenseSplitPersonSchema).optional(),
  /** Transaction direction: income / expense / transfer (text parse only) */
  txType: txTypeSchema.optional(),
  /** Hint for source account (e.g. "SCB", "Kplus", "เงินสด", "กรุงไทย") — text parse only */
  accountHint: z.preprocess((v) => {
    if (v == null || v === '') return undefined;
    return String(v).trim() || undefined;
  }, z.string().optional()),
  /** Hint for destination account when txType is transfer — text parse only */
  transferToAccountHint: z.preprocess((v) => {
    if (v == null || v === '') return undefined;
    return String(v).trim() || undefined;
  }, z.string().optional()),
});

function isTransferSlipDocumentType(val: unknown): boolean {
  if (val == null || val === '') return false;
  const s = String(val).toLowerCase().replace(/[\s-]+/g, '_');
  return s.includes('transfer') || s.includes('slip') || s.includes('bank');
}

/**
 * Soften common OCR omissions before strict Zod checks:
 * - sum item prices into totalAmount when total is missing/0
 * - default missing main category to Shopping (Others for transfer slips)
 * - fill missing item categories from the main receipt category
 */
function softenReceiptPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
  const obj = { ...(raw as Record<string, unknown>) };

  const isTransfer = isTransferSlipDocumentType(obj.documentType);
  if (obj.category == null || obj.category === '') {
    obj.category = isTransfer ? 'Others' : 'Shopping';
  }
  const mainCategory = String(obj.category);

  const items = Array.isArray(obj.items) ? obj.items : undefined;
  if (items?.length) {
    const sum = items.reduce((acc: number, item) => {
      if (!item || typeof item !== 'object') return acc;
      const n = toAiNumber((item as Record<string, unknown>).price);
      return acc + (n ?? 0);
    }, 0);

    const totalN = toAiNumber(obj.totalAmount);
    if ((totalN === undefined || totalN <= 0) && sum > 0) {
      obj.totalAmount = Math.round(sum * 100) / 100;
    }

    obj.items = items.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
      const row = { ...(item as Record<string, unknown>) };
      if (row.category == null || row.category === '') {
        row.category = mainCategory;
      }
      return row;
    });
  }

  return obj;
}

export const receiptParseSchema = z.preprocess(softenReceiptPayload, receiptParseObjectSchema);

export type ReceiptParseResult = z.infer<typeof receiptParseObjectSchema>;

/**
 * Multi-draft schema for natural-language text parsing.
 * Handles legacy single-object responses and `{ transactions: [...] }` shape.
 */
function wrapToMultiDraft(raw: unknown): unknown {
  if (raw == null) return { drafts: [] };
  if (Array.isArray(raw)) return { drafts: raw };
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.drafts) && obj.drafts.length > 0) return obj;
    if (Array.isArray(obj.transactions) && obj.transactions.length > 0) return { drafts: obj.transactions };
    // Legacy single object — wrap in array
    return { drafts: [raw] };
  }
  return { drafts: [] };
}

export const expenseTextMultiParseSchema = z.preprocess(
  wrapToMultiDraft,
  z.object({
    drafts: z.array(z.preprocess(softenReceiptPayload, receiptParseObjectSchema)).min(1),
  })
);

export type ExpenseTextMultiParseResult = z.infer<typeof expenseTextMultiParseSchema>;

/** Shared context for receipt image + text AI (trip defaults + optional user hints). */
export interface ReceiptAiContext {
  tripName?: string;
  currency?: string;
  countryCode?: string;
  /** Appended to prompts for receipt scanning (Thai/English user hints). */
  extraInstructions?: string;
}

/** Context for natural-language expense text parsing */
export interface ExpenseTextAiContext {
  tripName?: string;
  currency?: string;
  countryCode?: string;
  /** Serialized contacts hint for the model */
  contactsHint?: string;
}

export const RECEIPT_PARSE_PROMPT = `You are a receipt and bank transfer slip OCR parser for a personal finance app.
Read the image and return ONLY one JSON object — no markdown, no code fences, no explanation.

Required JSON shape:
{
  "documentType": "receipt" | "transfer_slip",
  "description": string,
  "category": string,
  "date": "YYYY-MM-DD",
  "time": "HH:mm" (optional, 24-hour),
  "totalAmount": number,
  "currency": "THB" | "USD" | "EUR" | "JPY" | "GBP" | "CNY" | "SGD" | "HKD" | "AUD" | "KRW" | ... (optional),
  "taxMode": "exclusive" | "inclusive" (optional),
  "baseAmount": number (optional),
  "taxAmount": number (optional),
  "discount": number (optional, non-negative),
  "items": [{ "name": string, "category": string, "price": number, "tax": number (optional) }] (optional)
}

Extraction rules:
- documentType: "receipt" for store/restaurant receipts; "transfer_slip" for bank or payment app transfer screenshots
- description: short label — store name, merchant, or transfer memo (Thai or English)
- category: exactly one of: Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- category default for documentType "receipt": when unsure or merchant type is ambiguous, use "Shopping" (do NOT default to Food & Dining or Others). Use Food & Dining only when the receipt clearly is a restaurant/cafe/food vendor
- date: transaction date as YYYY-MM-DD from the receipt or slip; use today's date only if truly unreadable
- time: transaction time as HH:mm (24-hour) — look for printed time near the date, payment timestamp, "เวลา", "Time", or POS clock; convert 12h AM/PM to 24h; omit only if no time is visible anywhere on the image
- totalAmount: final paid amount as a plain number (no symbols, no commas)
- currency: ISO currency code (THB for ฿/baht, JPY for ¥/yen, USD for $, EUR for €, etc.); omit if unknown
- taxMode: "exclusive" if tax is added on top, "inclusive" if tax is included in prices
- baseAmount / taxAmount: fill when subtotal and tax are visible on the receipt
- discount: fill when a discount, promotion, or coupon reduction is visible (non-negative number)
- items: each visible line item with name, category, and line price as number; when an item's category is unclear, use the same category as the main receipt category
- transfer_slip: category usually "Others"; items may be omitted; description = payee or transfer note

Accuracy:
- Prefer amounts printed on the receipt over guessed values
- Do not invent line items that are not on the image
- All numeric fields must be JSON numbers, not strings`;

export const EXPENSE_TEXT_PARSE_PROMPT = `You are an expense data extractor for a personal finance app — NOT a chatbot.
The user types expense notes in Thai or English (one or multiple lines/events).
Return ONLY a JSON object with a "drafts" array — no markdown, no explanation, no questions.

ALWAYS use this output shape:
{
  "drafts": [
    {
      "documentType": "receipt",
      "txType": "expense" | "income" | "transfer",
      "description": string,
      "category": string,
      "date": "YYYY-MM-DD",
      "time": "HH:mm" (optional, 24-hour),
      "totalAmount": number,
      "currency": "THB" | "USD" | "EUR" | "JPY" | ... (optional ISO code),
      "items": [{ "name": string, "category": string, "price": number }] (optional),
      "accountHint": string (optional — bank/wallet name as spoken: "SCB", "Kplus", "เงินสด", "กรุงไทย"),
      "transferToAccountHint": string (optional — only for txType "transfer"),
      "paymentMethod": "normal" | "paotang" (optional),
      "debtTracking": boolean (optional),
      "splitMode": "equal" | "custom" | "solo" (optional),
      "payers": [{ "name": string, "amount": number }] (optional),
      "shares": [{ "name": string, "amount": number }] (optional)
    },
    ...
  ]
}

--- Multi-draft rules ---
- ALWAYS return { "drafts": [ ... ] } — even for a single expense
- Each separate transaction/event/purchase = ONE separate draft in the array
- Multi-line input: each line that describes a distinct purchase or event = its own draft
- Example: "นั่งวิน 10\nข้าวเที่ยง 45\nกาแฟ 30" → 3 drafts
- One-liner multi-item "ไก่ทอด 20 กาแฟ 45": if clearly one purchase/receipt → 1 draft with items[]; if clearly separate → 2 drafts

--- Date & time rules ---
- "ทั้งหมดนี้วันที่ 25 สิงหา 69" or similar date-block markers in THAI BUDDHIST YEAR (พ.ศ.) — convert to CE: BE 2569 → CE 2026; apply that date to all drafts in the block until a new date marker appears
- Buddhist months: ม.ค.=01 ก.พ.=02 มี.ค.=03 เม.ย.=04 พ.ค.=05 มิ.ย.=06 ก.ค.=07 ส.ค.=08 ก.ย.=09 ต.ค.=10 พ.ย.=11 ธ.ค.=12; full names: มกราคม=01 กุมภาพันธ์=02 มีนาคม=03 เมษายน=04 พฤษภาคม=05 มิถุนายน=06 กรกฎาคม=07 สิงหาคม=08 กันยายน=09 ตุลาคม=10 พฤศจิกายน=11 ธันวาคม=12
- "สิงหา 69" = August 2026; "ธ.ค. 67" = December 2024
- Times like "09.00", "10.40", "09:00" → time "09:00", "10:40"
- Use today's date if no date is stated; use current time HH:mm if no time stated
- "บ่าย 3" = 15:00; "2 ทุ่ม" = 20:00; "ตี 1" = 01:00

--- txType rules ---
- Default txType: "expense"
- Income (txType "income", totalAmount POSITIVE): โอนเงินเข้า, ได้รับเงิน, ลูกค้าโอน, เงินเข้า, ให้เงิน (received), ขายของได้, received, income, salary
- Transfer (txType "transfer"): โอนจาก X ไป Y, โอนเงินออก, โอนให้ (self-transfer between own accounts)
  - accountHint = source account; transferToAccountHint = destination account
- Expense (txType "expense"): purchases, bills, นั่งวิน, ข้าว, จ่าย, etc.

--- Account hint rules ---
- เงินสด, cash → accountHint "เงินสด"
- SCB, กสิกร, กรุงไทย, BBL, Kplus, ทรูมันนี่, TrueMoney → accountHint as spoken
- Only set accountHint when user clearly names a source account

--- Category rules ---
- Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- นั่งวิน, แท็กซี่, grab, รถ, bus, mrt, bts → Transport
- ข้าว, กาแฟ, อาหาร, ทอด → Food & Dining
- ค่าไฟ, อินเทอร์เน็ต → Bills & Utilities

--- Split / debt / payment ---
- ผม, ฉัน, ตัวเอง, me, myself → name "Me" in payers/shares
- When a known contact list is provided, use their exact displayName in payers/shares
- จ่ายให้, จ่ายแทน, ออกให้, paid for, fronted → that person is a payer with their paid amount
- คืน, ต้องคืน, เป็นหนี้, owe → debtTracking true
- แบ่ง, หาร, คนละ, เท่าๆกัน, split equally → splitMode "equal"
- คนเดียว, solo → splitMode "solo"
- Custom amounts per person → splitMode "custom" with explicit shares
- เป๋าตัง, เป๋าตังค์, paotang, สิทธิ์รัฐ → paymentMethod "paotang"
- debtTracking: true when friends owe each other from this expense
- If no split mentioned, omit payers, shares, splitMode

--- Currency rules ---
- "บ" or "บาท" = THB; "$" = USD; "¥" = JPY; "€" = EUR; etc.
- Use ISO 4217 codes (THB, USD, EUR, JPY, GBP, CNY, SGD, HKD, KRW, AUD, CAD, CHF, ...)
- Omit currency if not explicitly stated (let context default apply)`;
