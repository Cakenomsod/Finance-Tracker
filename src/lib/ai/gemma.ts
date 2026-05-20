import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  receiptParseSchema,
  RECEIPT_PARSE_PROMPT,
  EXPENSE_TEXT_PARSE_PROMPT,
  type ReceiptParseResult,
} from '@/lib/ai/receipt-schema';
import { parseJsonFromAiContent } from '@/lib/ai/parse-json';
import {
  geminiModelCandidates,
  getChatModel,
  getGoogleAiApiKey,
  getReceiptModel,
} from '@/lib/ai/env';

function getClient() {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY is not configured');
  }
  return new GoogleGenerativeAI(apiKey);
}

async function generateJsonWithModels(
  modelNames: string[],
  parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }>
): Promise<ReceiptParseResult> {
  const genAI = getClient();
  let lastError: Error | null = null;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const result = await model.generateContent(parts);
      const text = result.response.text();
      if (!text?.trim()) {
        throw new Error('Empty response from Google AI');
      }

      const parsed = parseJsonFromAiContent(text);
      return receiptParseSchema.parse(parsed);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[AI] model ${modelName} failed:`, lastError.message);
    }
  }

  throw lastError ?? new Error('All Google AI models failed');
}

export async function parseReceiptImage(
  imageBuffer: Buffer,
  mimeType: string,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  const contextHint = context
    ? `\nTrip context: name="${context.tripName || ''}", currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  return generateJsonWithModels(
    geminiModelCandidates(getReceiptModel()),
    [
      { text: RECEIPT_PARSE_PROMPT + contextHint },
      {
        inlineData: {
          mimeType,
          data: imageBuffer.toString('base64'),
        },
      },
    ]
  );
}

export async function parseExpenseText(
  text: string,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  const contextHint = context
    ? `\nContext: trip="${context.tripName || ''}", default currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  return generateJsonWithModels(
    geminiModelCandidates(getChatModel()),
    [{ text: EXPENSE_TEXT_PARSE_PROMPT + contextHint + `\n\nUser input:\n${text.trim()}` }]
  );
}

export async function sendChatMessage(
  message: string,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  const genAI = getClient();
  const model = genAI.getGenerativeModel({
    model: getChatModel(),
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

  while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
    geminiHistory.shift();
  }

  const chat = model.startChat({ history: geminiHistory });
  const result = await chat.sendMessage(message);
  return result.response.text();
}
