/** Default Google AI model (Gemini 2.0 Flash is deprecated for new API keys). */
export const GEMINI_FLASH_DEFAULT = 'gemini-2.5-flash';

/** @deprecated Use GEMINI_FLASH_DEFAULT */
export const GEMINI_2_FLASH = GEMINI_FLASH_DEFAULT;

const DEPRECATED_GEMINI_IDS = new Set([
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
]);

/** Fallback order when the primary model is unavailable. */
export const GEMINI_MODEL_FALLBACKS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
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
