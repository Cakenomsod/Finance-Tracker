import { ZodError } from 'zod';

/** User-facing message for AI parse failures (avoids dumping raw Zod JSON). */
export function formatAiParseError(error: unknown, fallback = 'Parse failed'): string {
  if (error instanceof ZodError) {
    const fields = [...new Set(error.issues.map((i) => i.path.join('.') || 'root'))]
      .filter(Boolean)
      .slice(0, 4);
    const hint = fields.length ? ` (fields: ${fields.join(', ')})` : '';
    return `AI returned incomplete or invalid receipt data${hint} — try again with a clearer photo`;
  }
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message;
    if (/no longer available|404 Not Found|models\/gemini/i.test(msg)) {
      return 'โมเดล Gemini บนเซิร์ฟเวอร์ล้าสมัยหรือถูกจำกัดสิทธิ์ — อัปเดต AI_RECEIPT_MODEL เป็น gemini-3.6-flash แล้วลองใหม่';
    }
    if (/\[GoogleGenerativeAI Error\]/i.test(msg)) {
      const short = msg.replace(/^\[GoogleGenerativeAI Error\]:\s*/i, '').trim();
      return short.length > 220 ? `${short.slice(0, 220)}…` : short;
    }
    return msg;
  }
  return fallback;
}
