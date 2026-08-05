/**
 * Default Google AI Flash model.
 * Gemini 2.5 / 2.0 Flash are capacity-gated or retired for many API keys
 * ("no longer available to new users") — prefer Gemini 3.x.
 */
export const GEMINI_FLASH_DEFAULT = 'gemini-3.6-flash';

/** @deprecated Use GEMINI_FLASH_DEFAULT */
export const GEMINI_2_FLASH = GEMINI_FLASH_DEFAULT;

/** Model ids that should be remapped to GEMINI_FLASH_DEFAULT. */
const DEPRECATED_GEMINI_IDS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
]);

/** Fallback order when the primary model is unavailable. */
export const GEMINI_MODEL_FALLBACKS = [
  'gemini-3.6-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
  'gemini-3-flash-preview',
] as const;

/** Trim env values (handles `.env` entries like `KEY = value`). */
export function envTrim(key: string, fallback?: string): string | undefined {
  const raw = process.env[key];
  if (raw != null && raw.trim() !== '') return raw.trim();
  return fallback;
}

export function getGoogleAiApiKey(): string | undefined {
  return (
    envTrim('GOOGLE_AI_API_KEY') ||
    envTrim('GEMINI_API_KEY') ||
    envTrim('GOOGLE_API_KEY')
  );
}

/** Map legacy/invalid model ids to the current default Flash model. */
export function normalizeGeminiModel(name: string | undefined): string {
  const n = (name || '').trim();
  if (!n || n.startsWith('gemma-') || DEPRECATED_GEMINI_IDS.has(n)) {
    return GEMINI_FLASH_DEFAULT;
  }
  return n;
}

export function geminiModelCandidates(primary: string | undefined): string[] {
  const main = normalizeGeminiModel(primary);
  return [...new Set([main, ...GEMINI_MODEL_FALLBACKS])];
}

export function getReceiptModel(): string {
  return normalizeGeminiModel(envTrim('AI_RECEIPT_MODEL'));
}

export function getChatModel(): string {
  return normalizeGeminiModel(envTrim('AI_CHAT_MODEL')) || getReceiptModel();
}

export function getImmichApiKey(): string | undefined {
  return envTrim('IMMICH_API_KEY');
}
