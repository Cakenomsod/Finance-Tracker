import { AiTextProvider } from '@/lib/firestore-types';
import type { ReceiptAiContext, ExpenseTextAiContext, ReceiptParseResult } from '@/lib/ai/receipt-schema';
import type { AiInsightLlmResult } from '@/lib/ai/insight-schema';
import {
  parseReceiptImage,
  parseExpenseText,
  sendChatMessage as sendChatMessageGemma,
  generateInsights as generateInsightsGemma,
} from '@/lib/ai/gemma';
import {
  parseReceiptImageLocal,
  parseExpenseTextLocal,
  sendChatMessageLocal,
  generateInsightsLocal,
  type LocalAiConfig,
} from '@/lib/ai/local';
import { buildContactsPromptHint, resolveSplitPeople } from '@/lib/ai/contact-resolve';
import type { AiContact } from '@/lib/ai/contact-resolve';
import { tryParseExpenseTextStrictFormat } from '@/lib/ai/expense-text-heuristic';
import { normalizeReceiptDateTime, aiTimeZoneFromContext } from '@/lib/ai/ai-datetime';
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
    return normalizeReceiptDateTime(
      await parseReceiptImageLocal(imageBuffer, mimeType, config.localAiConfig, context),
      aiTimeZoneFromContext(context)
    );
  }

  // Default to Gemma API
  return normalizeReceiptDateTime(
    await parseReceiptImage(imageBuffer, mimeType, context),
    aiTimeZoneFromContext(context)
  );
}

/**
 * Parse natural-language expense text (e.g. "ไก่ทอด 20 กาแฟ 45")
 */
export async function parseExpenseTextWithProvider(
  text: string,
  config: AiProviderConfig,
  context?: ExpenseTextAiContext,
  contacts?: AiContact[]
): Promise<ReceiptParseResult> {
  const currency =
    context?.currency === 'JPY' || context?.currency === 'THB'
      ? context.currency
      : 'THB';

  const timeZone = aiTimeZoneFromContext(context);

  const strictMatch = tryParseExpenseTextStrictFormat(text, currency);
  if (strictMatch) return normalizeReceiptDateTime(strictMatch, timeZone);

  const enrichedContext: ExpenseTextAiContext = {
    ...context,
    contactsHint: contacts?.length ? buildContactsPromptHint(contacts) : context?.contactsHint,
  };

  let result: ReceiptParseResult;
  try {
    if (config.provider === 'local') {
      if (!config.localAiConfig?.baseUrl) {
        throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
      }
      result = await parseExpenseTextLocal(text, config.localAiConfig, enrichedContext);
    } else {
      result = await parseExpenseText(text, enrichedContext);
    }
  } catch (aiError) {
    const retry = tryParseExpenseTextStrictFormat(text, currency);
    if (retry) return normalizeReceiptDateTime(retry, timeZone);

    if (config.provider === 'local' && getGoogleAiApiKey()) {
      try {
        result = await parseExpenseText(text, enrichedContext);
      } catch {
        throw aiError;
      }
    } else {
      throw aiError;
    }
  }

  if (contacts?.length) {
    return normalizeReceiptDateTime(
      {
        ...result,
        payers: resolveSplitPeople(result.payers, contacts),
        shares: resolveSplitPeople(result.shares, contacts),
      },
      timeZone
    );
  }

  return normalizeReceiptDateTime(result, timeZone);
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

/**
 * Generate structured financial insights using the specified AI provider.
 */
export async function generateInsightsWithProvider(
  prompt: string,
  config: AiProviderConfig
): Promise<{ result: AiInsightLlmResult; model: string; provider: AiTextProvider }> {
  if (config.provider === 'local') {
    if (!config.localAiConfig?.baseUrl) {
      throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
    }
    const { result, model } = await generateInsightsLocal(prompt, config.localAiConfig);
    return { result, model, provider: 'local' };
  }

  const { result, model } = await generateInsightsGemma(prompt);
  return { result, model, provider: 'gemma' };
}

export { testLocalAiConnection } from '@/lib/ai/local';
