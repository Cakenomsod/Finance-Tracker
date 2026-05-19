import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  receiptParseSchema,
  RECEIPT_PARSE_PROMPT,
  EXPENSE_TEXT_PARSE_PROMPT,
  type ReceiptParseResult,
} from '@/lib/ai/receipt-schema';

const MODEL = process.env.AI_RECEIPT_MODEL || 'gemma-4-31b-it';

function getClient() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

export async function parseReceiptImage(
  imageBuffer: Buffer,
  mimeType: string,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
    },
  });

  const contextHint = context
    ? `\nTrip context: name="${context.tripName || ''}", currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  const result = await model.generateContent([
    { text: RECEIPT_PARSE_PROMPT + contextHint },
    {
      inlineData: {
        mimeType,
        data: imageBuffer.toString('base64'),
      },
    },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text);
  return receiptParseSchema.parse(parsed);
}

export async function parseExpenseText(
  text: string,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: process.env.AI_CHAT_MODEL || MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const contextHint = context
    ? `\nContext: trip="${context.tripName || ''}", default currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  const result = await model.generateContent([
    { text: EXPENSE_TEXT_PARSE_PROMPT + contextHint + `\n\nUser input:\n${text.trim()}` },
  ]);

  const parsed = JSON.parse(result.response.text());
  return receiptParseSchema.parse(parsed);
}

export async function sendChatMessage(
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: process.env.AI_CHAT_MODEL || MODEL,
    generationConfig: {
      temperature: 0.7,
    },
  });

  const geminiHistory = (history || [])
    .filter((h) => h.content.trim())
    .map((h) => ({
      role: (h.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
      parts: [{ text: h.content }],
    }));

  // Gemini chat history must start with a user turn
  while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
    geminiHistory.shift();
  }

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  return result.response.text();
}
