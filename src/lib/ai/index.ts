import { AiTextProvider } from '@/lib/firestore-types';
import { parseReceiptImage } from '@/lib/ai/gemma';
import {
  parseReceiptImageLocal,
  sendChatMessageLocal,
  type LocalAiConfig,
} from '@/lib/ai/local';
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema';

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
  context?: { tripName?: string; currency?: string; countryCode?: string }
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

  throw new Error('Text chat with Gemma API is not yet implemented');
}

export { testLocalAiConnection } from '@/lib/ai/local';
