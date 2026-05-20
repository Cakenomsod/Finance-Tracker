import { AiTextProvider } from '@/lib/firestore-types';
import type { ReceiptAiContext } from '@/lib/ai/receipt-schema';
import {
  parseReceiptImage,
  parseExpenseText,
  sendChatMessage as sendChatMessageGemma,
} from '@/lib/ai/gemma';
import {
  parseReceiptImageLocal,
  parseExpenseTextLocal,
  sendChatMessageLocal,
  type LocalAiConfig,
} from '@/lib/ai/local';
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema';
import { tryParseExpenseTextStrictFormat } from '@/lib/ai/expense-text-heuristic';
import { getGoogleAiApiKey } from '@/lib/ai/env';

export interface AiProviderConfig {
  provider: AiTextProvider;
  localAiConfig?: LocalAiConfig;
}

/**
 * Parse receipt image using the specified AI provider
 */
export async function parseReceiptImageWithProvider(
  imageBuffer: Buffer,
  mimeType: string,
  config: AiProviderConfig,
  context?: ReceiptAiContext
): Promise<ReceiptParseResult> {
  if (config.provider === 'local') {
    if (!config.localAiConfig?.baseUrl) {
      throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
    }
    return parseReceiptImageLocal(imageBuffer, mimeType, config.localAiConfig, context);
  }

  // Default to Gemma API
  return parseReceiptImage(imageBuffer, mimeType, context);
}

/**
 * Parse natural-language expense text (e.g. "ไก่ทอด 20 กาแฟ 45")
 */
export async function parseExpenseTextWithProvider(
  text: string,
  config: AiProviderConfig,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  const currency =
    context?.currency === 'JPY' || context?.currency === 'THB'
      ? context.currency
      : 'THB';

  const strictMatch = tryParseExpenseTextStrictFormat(text, currency);
  if (strictMatch) return strictMatch;

  try {
    if (config.provider === 'local') {
      if (!config.localAiConfig?.baseUrl) {
        throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
      }
      return await parseExpenseTextLocal(text, config.localAiConfig, context);
    }

    return await parseExpenseText(text, context);
  } catch (aiError) {
    const retry = tryParseExpenseTextStrictFormat(text, currency);
    if (retry) return retry;

    // Local ล้ม → ลอง Gemini 2 Flash เป็นตัวสำรอง
    if (config.provider === 'local' && getGoogleAiApiKey()) {
      try {
        return await parseExpenseText(text, context);
      } catch {
        // keep original error below
      }
    }

    throw aiError;
  }
}

/**
 * Send a chat message using the specified AI provider
 */
export async function sendChatWithProvider(
  message: string,
  config: AiProviderConfig,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (config.provider === 'local') {
    if (!config.localAiConfig?.baseUrl) {
      throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
    }
    return sendChatMessageLocal(message, config.localAiConfig, history);
  }

  return sendChatMessageGemma(message, history);
}

export { testLocalAiConnection } from '@/lib/ai/local';
