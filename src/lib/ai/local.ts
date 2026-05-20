import {
  receiptParseSchema,
  RECEIPT_PARSE_PROMPT,
  EXPENSE_TEXT_PARSE_PROMPT,
  type ReceiptParseResult,
} from '@/lib/ai/receipt-schema';
import { parseJsonFromAiContent } from '@/lib/ai/parse-json';
import { extractLocalAiMessageContent } from '@/lib/ai/local-response';
import { envTrim } from '@/lib/ai/env';
import { tryParseExpenseTextHeuristic } from '@/lib/ai/expense-text-heuristic';

export interface LocalAiConfig {
  baseUrl: string;
  model?: string;
}

const DEFAULT_MODEL = envTrim('LOCAL_AI_MODEL') || 'google/gemma-4-e2b';

function getLocalAiTimeoutMs(): number {
  const raw = envTrim('LOCAL_AI_TIMEOUT_MS');
  const parsed = raw ? parseInt(raw, 10) : 180_000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 180_000;
}

function wrapLocalAiError(error: unknown, action: string): Error {
  if (error instanceof Error && error.name === 'TimeoutError') {
    return new Error(
      `${action}: Local AI ใช้เวลานานเกินไป (${Math.round(getLocalAiTimeoutMs() / 1000)}s) — ลองใช้ Gemma ใน Settings หรือเพิ่ม LOCAL_AI_TIMEOUT_MS`
    );
  }
  if (error instanceof Error) {
    return new Error(`${action}: ${error.message}`);
  }
  return new Error(action);
}

/**
 * Parse receipt image using local AI (e.g., Ollama, LM Studio)
 * Assumes the local AI server is compatible with OpenAI API
 */
export async function parseReceiptImageLocal(
  imageBuffer: Buffer,
  mimeType: string,
  config: LocalAiConfig,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  if (!config.baseUrl) {
    throw new Error('Local AI baseUrl is not configured');
  }

  const baseUrl = normalizeUrl(config.baseUrl);
  const model = config.model || DEFAULT_MODEL;
  const imageBase64 = imageBuffer.toString('base64');

  const contextHint = context
    ? `\nTrip context: name="${context.tripName || ''}", currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: RECEIPT_PARSE_PROMPT + contextHint,
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${imageBase64}`,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(getLocalAiTimeoutMs()),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = extractLocalAiMessageContent(
      data as Parameters<typeof extractLocalAiMessageContent>[0]
    );

    if (!content) {
      throw new Error('No response from local AI');
    }

    const parsed = parseJsonFromAiContent(content);
    return receiptParseSchema.parse(parsed);
  } catch (error) {
    throw wrapLocalAiError(error, 'Failed to parse receipt with local AI');
  }
}

export async function parseExpenseTextLocal(
  text: string,
  config: LocalAiConfig,
  context?: { tripName?: string; currency?: string; countryCode?: string }
): Promise<ReceiptParseResult> {
  if (!config.baseUrl) {
    throw new Error('Local AI baseUrl is not configured');
  }

  const baseUrl = normalizeUrl(config.baseUrl);
  const model = config.model || DEFAULT_MODEL;

  const contextHint = context
    ? `\nContext: trip="${context.tripName || ''}", default currency=${context.currency || 'THB'}, country=${context.countryCode || 'TH'}`
    : '';

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a JSON API. Reply with a single valid JSON object only in the message content field. ' +
              'Do not use chain-of-thought or reasoning — no markdown, no explanation, no preamble.',
          },
          {
            role: 'user',
            content: `${EXPENSE_TEXT_PARSE_PROMPT}${contextHint}\n\nUser input:\n${text.trim()}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 2048,
        stream: false,
      }),
      signal: AbortSignal.timeout(getLocalAiTimeoutMs()),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = extractLocalAiMessageContent(
      data as Parameters<typeof extractLocalAiMessageContent>[0]
    );

    if (!content) {
      const currency =
        context?.currency === 'JPY' || context?.currency === 'THB'
          ? context.currency
          : 'THB';
      const fallback = tryParseExpenseTextHeuristic(text, currency);
      if (fallback) return fallback;
      throw new Error('No response from local AI (ลองพิมพ์แบบ "ชื่อรายการ จำนวนเงิน" เช่น ไก่ทอด 20)');
    }

    return receiptParseSchema.parse(parseJsonFromAiContent(content));
  } catch (error) {
    const currency =
      context?.currency === 'JPY' || context?.currency === 'THB'
        ? context.currency
        : 'THB';
    const fallback = tryParseExpenseTextHeuristic(text, currency);
    if (fallback) return fallback;
    throw wrapLocalAiError(error, 'Failed to parse expense text with local AI');
  }
}

/**
 * Send a text message to local AI for chat
 */
export async function sendChatMessageLocal(
  message: string,
  config: LocalAiConfig,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
  if (!config.baseUrl) {
    throw new Error('Local AI baseUrl is not configured');
  }

  const baseUrl = normalizeUrl(config.baseUrl);
  const model = config.model || DEFAULT_MODEL;

  const messages = [
    ...(history || []),
    {
      role: 'user' as const,
      content: message,
    },
  ];

  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 512,
        stream: false,
      }),
      signal: AbortSignal.timeout(getLocalAiTimeoutMs()),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = extractLocalAiMessageContent(
      data as Parameters<typeof extractLocalAiMessageContent>[0]
    );

    if (!content) {
      throw new Error('No response from local AI');
    }

    return content;
  } catch (error) {
    throw wrapLocalAiError(error, 'Failed to get chat response from local AI');
  }
}

/**
 * Normalize local AI base URL
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim();
  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  // Ensure protocol
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    normalized = `http://${normalized}`;
  }
  return normalized;
}

/**
 * Test local AI connection
 */
/**
 * Test local AI connection (ปรับปรุงเพื่อรองรับ LM Studio / OpenAI Spec)
 */
export async function testLocalAiConnection(config: LocalAiConfig): Promise<boolean> {
  if (!config.baseUrl) {
    throw new Error('Local AI baseUrl is not configured');
  }

  const baseUrl = normalizeUrl(config.baseUrl);

  try {
    // 🚀 เปลี่ยนจาก /api/tags เป็น /v1/models (รองรับ LM Studio 100%)
    const response = await fetch(`${baseUrl}/v1/models`, {
      method: 'GET',
      // ใน Next.js 15 แนะนำให้ส่ง headers เผื่อกรณีบางเซิร์ฟเวอร์ดักจับ
      headers: { 'Content-Type': 'application/json' },
    });

    return response.ok;
  } catch (error) {
    console.error('Local AI ping test failed:', error);
    return false;
  }
}
