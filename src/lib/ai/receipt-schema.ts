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

export const RECEIPT_PARSE_PROMPT = `You are a receipt and bank transfer slip parser for a finance app.
Analyze the image and extract structured expense data.

Rules:
- documentType: "receipt" for store receipts, "transfer_slip" for bank/payment transfer screenshots
- description: short summary (store name or transfer note)
- category: one of: Food & Dining, Transport, Shopping, Entertainment, Bills & Utilities, Health & Fitness, Accommodation, Activities, Others
- date: ISO format YYYY-MM-DD (use today if unclear)
- totalAmount: final amount as number (no currency symbols)
- currency: THB or JPY if detectable
- taxMode: exclusive or inclusive if tax is shown
- items: line items when visible on receipt (optional for transfer slips)
- For transfer slips: category is usually "Others", items can be empty

Respond ONLY with valid JSON matching the schema.`;
