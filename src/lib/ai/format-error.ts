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
    return error.message;
  }
  return fallback;
}
