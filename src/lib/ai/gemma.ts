import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  receiptParseSchema,
  RECEIPT_PARSE_PROMPT,
  EXPENSE_TEXT_PARSE_PROMPT,
  type ReceiptParseResult,
  type ReceiptAiContext,
  type ExpenseTextAiContext,
} from '@/lib/ai/receipt-schema';
import {
  aiInsightLlmSchema,
  type AiInsightLlmResult,
} from '@/lib/ai/insight-schema';
import { parseJsonFromAiContent } from '@/lib/ai/parse-json';
import { buildAiDateContext, aiTimeZoneFromContext } from '@/lib/ai/ai-datetime';
import {
  geminiModelCandidates,
  getChatModel,
  getGoogleAiApiKey,
  getReceiptModel,
  normalizeGeminiModel,
} from '@/lib/ai/env';

function getClient() {
  const apiKey = getGoogleAiApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY or GEMINI_API_KEY is not configured on the server');
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
      console.error('[Gemini] generateJsonWithModels failed', {
        model: modelName,
        message: lastError.message,
        stack: lastError.stack?.split('\n').slice(0, 4).join(' | '),
      });
    }
  }

  throw lastError ?? new Error('All Google AI models failed');
}

export type ReceiptImageAiContext = ReceiptAiContext;

function buildReceiptContextHint(context?: ReceiptImageAiContext): string {
  const trip = context
    ? `\nTrip context: name="${context.tripName || ''}", currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';
  const extra = context?.extraInstructions?.trim()
    ? `\n\nAdditional user instructions (follow when consistent with JSON-only output above):\n${context.extraInstructions.trim()}`
    : '';
  return trip + extra;
}

export async function parseReceiptImage(
  imageBuffer: Buffer,
  mimeType: string,
  context?: ReceiptImageAiContext
): Promise<ReceiptParseResult> {
  const contextHint = buildReceiptContextHint(context);

  return generateJsonWithModels(
    geminiModelCandidates(getReceiptModel()),
    [
      { text: RECEIPT_PARSE_PROMPT + buildAiDateContext(aiTimeZoneFromContext(context)) + contextHint },
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
  context?: ExpenseTextAiContext
): Promise<ReceiptParseResult> {
  const contextHint = context
    ? `\nContext: trip="${context.tripName || ''}", default currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';
  const contactsHint = context?.contactsHint || '';

  return generateJsonWithModels(
    geminiModelCandidates(getChatModel()),
    [{ text: EXPENSE_TEXT_PARSE_PROMPT + buildAiDateContext(aiTimeZoneFromContext(context)) + contextHint + contactsHint + `\n\nUser input:\n${text.trim()}` }]
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

async function generateInsightJsonWithModels(
  modelNames: string[],
  prompt: string
): Promise<AiInsightLlmResult> {
  const genAI = getClient();
  let lastError: Error | null = null;

  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      });

      const result = await model.generateContent([{ text: prompt }]);
      const text = result.response.text();
      if (!text?.trim()) {
        throw new Error('Empty response from Google AI');
      }

      const parsed = parseJsonFromAiContent(text);
      return aiInsightLlmSchema.parse(parsed);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error('[Gemini] generateInsightJsonWithModels failed', {
        model: modelName,
        message: lastError.message,
      });
    }
  }

  throw lastError ?? new Error('All Google AI models failed');
}

export async function generateInsights(
  prompt: string
): Promise<{ result: AiInsightLlmResult; model: string }> {
  const model = getChatModel();
  const result = await generateInsightJsonWithModels(geminiModelCandidates(model), prompt);
  return { result, model: normalizeGeminiModel(model) };
}
