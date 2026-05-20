import { z } from 'zod';

export const receiptItemSchema = z.object({
  name: z.string(),
  category: z.string(),
  price: z.number(),
  tax: z.number().optional(),
  taxCategoryId: z.enum(['food', 'goods', 'standard', 'exempt']).optional(),
});

export const receiptParseSchema = z.object({
  documentType: z.enum(['receipt', 'transfer_slip']),
  description: z.string(),
  category: z.string(),
  date: z.string(),
  totalAmount: z.number().positive(),
  currency: z.enum(['THB', 'JPY']).optional(),
  taxMode: z.enum(['exclusive', 'inclusive']).optional(),
  items: z.array(receiptItemSchema).optional(),
  baseAmount: z.number().optional(),
  taxAmount: z.number().optional(),
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

export const RECEIPT_PARSE_PROMPT = `You are a receipt and bank transfer slip OCR parser for a personal finance app.
Read the image and return ONLY one JSON object — no markdown, no code fences, no explanation.

Required JSON shape:
{
  "documentType": "receipt" | "transfer_slip",
  "description": string,
  "category": string,
  "date": "YYYY-MM-DD",
  "totalAmount": number,
  "currency": "THB" | "JPY" (optional),
  "taxMode": "exclusive" | "inclusive" (optional),
  "baseAmount": number (optional),
  "taxAmount": number (optional),
  "items": [{ "name": string, "category": string, "price": number, "tax": number (optional) }] (optional)
}

Extraction rules:
- documentType: "receipt" for store/restaurant receipts; "transfer_slip" for bank or payment app transfer screenshots
- description: short label — store name, merchant, or transfer memo (Thai or English)
- category: exactly one of: Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- date: transaction date as YYYY-MM-DD; use today's date only if truly unreadable
- totalAmount: final paid amount as a plain number (no symbols, no commas)
- currency: THB for ฿/baht, JPY for ¥/yen; omit if unknown
- taxMode: "exclusive" if tax is added on top, "inclusive" if tax is included in prices
- baseAmount / taxAmount: fill when subtotal and tax are visible on the receipt
- items: each visible line item with name, best-matching category, and line price as number
- transfer_slip: category usually "Others"; items may be omitted; description = payee or transfer note

Accuracy:
- Prefer amounts printed on the receipt over guessed values
- Do not invent line items that are not on the image
- All numeric fields must be JSON numbers, not strings`;

export const EXPENSE_TEXT_PARSE_PROMPT = `You are an expense data extractor for a personal finance app — NOT a chatbot.
The user types a short expense note in Thai or English. Return ONLY one JSON object — no markdown, no explanation, no questions.

Use the same JSON shape as receipt parsing:
{
  "documentType": "receipt",
  "description": string,
  "category": string,
  "date": "YYYY-MM-DD",
  "totalAmount": number,
  "currency": "THB" | "JPY" (optional),
  "items": [{ "name": string, "category": string, "price": number }] (optional)
}

Rules:
- NEVER ask questions or give advice — only extract data for a form
- "ไก่ทอด 20 บาท" → description "ไก่ทอด", totalAmount 20, category "Food & Dining", date = today
- Multiple items: "ไก่ทอด 20 กาแฟ 45" → items array + totalAmount = sum of prices
- "บ" or "บาท" = THB; use today's date (YYYY-MM-DD) unless a date is stated
- category: one of Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- documentType is always "receipt" for text input
- description: short summary of the expense (main item or comma-separated names)
- totalAmount must equal sum of items when items are provided`;
