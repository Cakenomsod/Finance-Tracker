import {
  receiptParseSchema,
  RECEIPT_PARSE_PROMPT,
  type ReceiptParseResult,
} from '@/lib/ai/receipt-schema';

export interface LocalAiConfig {
  baseUrl: string;
  model?: string;
}

const DEFAULT_MODEL = 'google/gemma-4-e2b';
const FETCH_TIMEOUT_MS = 60_000;

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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from local AI');
    }

    // Extract JSON from markdown code blocks if necessary
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
    const jsonStr = jsonMatch[1] || content;
    const parsed = JSON.parse(jsonStr);

    return receiptParseSchema.parse(parsed);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse receipt with local AI: ${error.message}`);
    }
    throw error;
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
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local AI error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No response from local AI');
    }

    return content;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get chat response from local AI: ${error.message}`);
    }
    throw error;
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
