import { z } from 'zod';

export const receiptItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.number(),
  tax: z.number().optional(),
  taxCategoryId: z.enum(['food', 'goods', 'standard', 'exempt']).optional(),
});

export const expenseSplitPersonSchema = z.object({
  name: z.string(),
  amount: z.number().nonnegative(),
});

export const receiptParseSchema = z.object({
  documentType: z.enum(['receipt', 'transfer_slip']),
  description: z.string(),
  category: z.string(),
  date: z.string(),
  /** Transaction time HH:mm (24-hour), when visible on receipt/slip */
  time: z.string().optional(),
  totalAmount: z.number().positive(),
  currency: z.enum(['THB', 'JPY']).optional(),
  taxMode: z.enum(['exclusive', 'inclusive']).optional(),
  items: z.array(receiptItemSchema).optional(),
  baseAmount: z.number().optional(),
  taxAmount: z.number().optional(),
  discount: z.number().nonnegative().optional(),
  /** Expense text only — how the bill was paid */
  paymentMethod: z.enum(['normal', 'paotang']).optional(),
  /** Expense text only — track friend debts from split */
  debtTracking: z.boolean().optional(),
  /** Expense text only — equal / custom / solo split */
  splitMode: z.enum(['equal', 'custom', 'solo']).optional(),
  /** Who paid (names as spoken; resolved server-side) */
  payers: z.array(expenseSplitPersonSchema).optional(),
  /** Who owes shares of the bill */
  shares: z.array(expenseSplitPersonSchema).optional(),
});

export type ReceiptParseResult = z.infer<typeof receiptParseSchema>;

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
  "currency": "THB" | "JPY" (optional),
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
- date: transaction date as YYYY-MM-DD from the receipt or slip; use today's date only if truly unreadable
- time: transaction time as HH:mm (24-hour) — look for printed time near the date, payment timestamp, "เวลา", "Time", or POS clock; convert 12h AM/PM to 24h; omit only if no time is visible anywhere on the image
- totalAmount: final paid amount as a plain number (no symbols, no commas)
- currency: THB for ฿/baht, JPY for ¥/yen; omit if unknown
- taxMode: "exclusive" if tax is added on top, "inclusive" if tax is included in prices
- baseAmount / taxAmount: fill when subtotal and tax are visible on the receipt
- discount: fill when a discount, promotion, or coupon reduction is visible (non-negative number)
- items: each visible line item with name, best-matching category, and line price as number
- transfer_slip: category usually "Others"; items may be omitted; description = payee or transfer note

Accuracy:
- Prefer amounts printed on the receipt over guessed values
- Do not invent line items that are not on the image
- All numeric fields must be JSON numbers, not strings`;

export const EXPENSE_TEXT_PARSE_PROMPT = `You are an expense data extractor for a personal finance app — NOT a chatbot.
The user types a short expense note in Thai or English. Return ONLY one JSON object — no markdown, no explanation, no questions.

JSON shape (base fields + optional split/debt fields):
{
  "documentType": "receipt",
  "description": string,
  "category": string,
  "date": "YYYY-MM-DD",
  "time": "HH:mm" (optional, 24-hour),
  "totalAmount": number,
  "currency": "THB" | "JPY" (optional),
  "items": [{ "name": string, "category": string, "price": number }] (optional),
  "paymentMethod": "normal" | "paotang" (optional),
  "debtTracking": boolean (optional),
  "splitMode": "equal" | "custom" | "solo" (optional),
  "payers": [{ "name": string, "amount": number }] (optional),
  "shares": [{ "name": string, "amount": number }] (optional)
}

Rules:
- NEVER ask questions or give advice — only extract data for a form
- "ไก่ทอด 20 บาท" → description "ไก่ทอด", totalAmount 20, category "Food & Dining", date = today, time = current time HH:mm if not stated
- Multiple items: "ไก่ทอด 20 กาแฟ 45" → items array + totalAmount = sum of prices
- "บ" or "บาท" = THB; use today's date (YYYY-MM-DD) unless a date is stated
- If user mentions time ("14:30", "2 ทุ่ม", "บ่าย 3"): convert to HH:mm and fill time field
- category: one of Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- documentType is always "receipt" for text input
- description: short summary of the expense (main item or comma-separated names)
- totalAmount must equal sum of items when items are provided

Split / debt / payment (Thai & English):
- ผม, ฉัน, ตัวเอง, me, myself → name "Me" in payers/shares
- When a known contact list is provided, use their exact displayName in payers/shares
- จ่ายให้, จ่ายแทน, ออกให้, paid for, fronted → that person is a payer with their paid amount
- คืน, ต้องคืน, เป็นหนี้, owe → debtTracking true; shares reflect who owes what
- แบ่ง, หาร, คนละ, เท่าๆกัน, split equally → splitMode "equal"; divide totalAmount evenly across participants in shares
- คนเดียว, ไม่แบ่ง, solo → splitMode "solo"
- Custom amounts per person → splitMode "custom" with explicit shares amounts
- payers amounts should sum to totalAmount (or the amount actually paid)
- shares amounts should sum to totalAmount
- If someone paid the full bill and others owe them back, set payers to the payer(s) and shares to each person's owed portion
- เป๋าตัง, เป๋าตังค์, paotang, สิทธิ์รัฐ → paymentMethod "paotang"
- Omit paymentMethod when normal cash/card/bank transfer with no Paotang mention
- debtTracking: true when friends owe each other money from this expense; false only if user says not to track debt
- If no split mentioned, omit payers, shares, splitMode (solo expense paid by Me)`;
