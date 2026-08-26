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
import { isAppCurrency } from '@/lib/currency';
import {
  extractTimeFromLine,
  shouldForceLineSplit,
  splitExpenseTextIntoSegments,
} from '@/lib/ai/expense-text-split';

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

  return normalizeReceiptDateTime(
    await parseReceiptImage(imageBuffer, mimeType, context),
    aiTimeZoneFromContext(context)
  );
}

async function parseExpenseTextOnce(
  text: string,
  config: AiProviderConfig,
  context?: ExpenseTextAiContext
): Promise<ReceiptParseResult[]> {
  const fallbackCurrency: 'THB' | 'JPY' = context?.currency === 'JPY' ? 'JPY' : 'THB';

  const strictMatch = tryParseExpenseTextStrictFormat(text, fallbackCurrency);
  if (strictMatch) return [strictMatch];

  try {
    if (config.provider === 'local') {
      if (!config.localAiConfig?.baseUrl) {
        throw new Error('Local AI is not configured. Please set up Local AI URL in Settings.');
      }
      return await parseExpenseTextLocal(text, config.localAiConfig, context);
    }
    return await parseExpenseText(text, context);
  } catch (aiError) {
    const retry = tryParseExpenseTextStrictFormat(text, fallbackCurrency);
    if (retry) return [retry];

    if (config.provider === 'local' && getGoogleAiApiKey()) {
      try {
        return await parseExpenseText(text, context);
      } catch {
        throw aiError;
      }
    }
    throw aiError;
  }
}

function finalizeDrafts(
  drafts: ReceiptParseResult[],
  contacts: AiContact[] | undefined,
  timeZone: string
): ReceiptParseResult[] {
  return drafts.map((result) => {
    const resolved = contacts?.length
      ? {
          ...result,
          payers: resolveSplitPeople(result.payers, contacts),
          shares: resolveSplitPeople(result.shares, contacts),
        }
      : result;
    return normalizeReceiptDateTime(resolved, timeZone);
  });
}

/**
 * If the model still returns one receipt with items[] for a multi-time journal,
 * expand items into separate drafts (last-resort safeguard).
 */
function expandCollapsedReceiptIfNeeded(
  drafts: ReceiptParseResult[],
  originalText: string
): ReceiptParseResult[] {
  if (drafts.length !== 1) return drafts;
  const only = drafts[0];
  const items = (only.items ?? []).filter(
    (i) => i?.name?.trim() && Number.isFinite(i.price) && i.price > 0
  );
  if (items.length < 2) return drafts;
  if (!shouldForceLineSplit(originalText)) return drafts;

  return items.map((item) => ({
    ...only,
    description: item.name.trim(),
    category: item.category?.trim() || only.category,
    totalAmount: item.price,
    items: undefined,
    baseAmount: undefined,
    taxAmount: undefined,
    discount: undefined,
    time: undefined,
  }));
}

/**
 * Parse natural-language expense text.
 * Multi-line journals with different times are split into separate drafts
 * before the model runs (so they cannot collapse into one receipt).
 */
export async function parseExpenseTextWithProvider(
  text: string,
  config: AiProviderConfig,
  context?: ExpenseTextAiContext,
  contacts?: AiContact[]
): Promise<ReceiptParseResult[]> {
  const timeZone = aiTimeZoneFromContext(context);
  const defaultCurrency = isAppCurrency(context?.currency) ? context.currency : 'THB';

  const enrichedContext: ExpenseTextAiContext = {
    ...context,
    currency: defaultCurrency,
    contactsHint: contacts?.length ? buildContactsPromptHint(contacts) : context?.contactsHint,
  };

  let results: ReceiptParseResult[];

  if (shouldForceLineSplit(text)) {
    const segments = splitExpenseTextIntoSegments(text, timeZone);
    const settled = await Promise.all(
      segments.map(async (segment) => {
        const lineResults = await parseExpenseTextOnce(segment.text, config, enrichedContext);
        const lineTime = extractTimeFromLine(segment.text);
        return lineResults.map((draft) => ({
          ...draft,
          items: undefined,
          date: segment.dateHint || draft.date,
          time: lineTime || draft.time,
        }));
      })
    );
    const perLine = settled.flat();
    results =
      perLine.length > 0 ? perLine : await parseExpenseTextOnce(text, config, enrichedContext);
  } else {
    results = await parseExpenseTextOnce(text, config, enrichedContext);
    results = expandCollapsedReceiptIfNeeded(results, text);
  }

  return finalizeDrafts(results, contacts, timeZone);
}

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
