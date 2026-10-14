import { ZodError } from 'zod';

const THAI_TEXT = /[\u0E00-\u0E7F]/;

/**
 * User-facing message for AI failures. Raw provider/Zod details belong in server logs,
 * so only messages already written for users (Thai) pass through.
 */
export function formatAiParseError(
  error: unknown,
  fallback = 'AI ประมวลผลไม่สำเร็จ — ลองใหม่อีกครั้ง หรือจดเองด้วยปุ่ม + ไปก่อนได้'
): string {
  if (error instanceof ZodError) {
    return 'AI อ่านข้อมูลได้ไม่ครบ — ลองถ่ายรูปให้ชัดขึ้นหรือพิมพ์รายละเอียดเพิ่ม';
  }
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message;
    if (/429|quota|rate.?limit|resource.?exhausted/i.test(msg)) {
      return 'ตอนนี้มีคนใช้ AI เยอะ — รอสักครู่แล้วลองใหม่';
    }
    if (/no longer available|404 Not Found|models\/|api key|permission|ECONNREFUSED|fetch failed/i.test(msg)) {
      return 'ตอนนี้ AI ยังใช้ไม่ได้ — จดเองด้วยปุ่ม + ไปก่อนได้';
    }
    if (THAI_TEXT.test(msg) && msg.length <= 220) return msg;
  }
  return fallback;
}
