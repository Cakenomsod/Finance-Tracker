import { ZodError } from 'zod';
import { pick, type LocalizedText } from '@/lib/i18n';
import type { AppLocale } from '@/lib/locale';

const THAI_TEXT = /[\u0E00-\u0E7F]/;

/** Header the browser sends with the user's UI language (see getAuthHeaders). */
export const APP_LOCALE_HEADER = 'x-app-locale';

export function requestLocale(request: Request): AppLocale {
  const value = request.headers.get(APP_LOCALE_HEADER);
  return value === 'en' || value === 'zh' || value === 'th' ? value : 'th';
}

export const AI_UNAVAILABLE_MESSAGE: LocalizedText = {
  th: 'ตอนนี้ AI ยังใช้ไม่ได้ — จดเองด้วยปุ่ม + ไปก่อนได้',
  en: "AI isn't available right now — add it manually with the + button for now",
  zh: 'AI 暂时不可用 — 请先用 + 按钮手动记录',
};

const AI_FAILED_MESSAGE: LocalizedText = {
  th: 'AI ประมวลผลไม่สำเร็จ — ลองใหม่อีกครั้ง หรือจดเองด้วยปุ่ม + ไปก่อนได้',
  en: "AI couldn't process this — try again, or add it manually with the + button",
  zh: 'AI 处理失败 — 请重试，或先用 + 按钮手动记录',
};

/**
 * User-facing message for AI failures. Raw provider/Zod details belong in server logs,
 * so only messages already written for users (Thai) pass through, and only to Thai users.
 */
export function formatAiParseError(error: unknown, locale: AppLocale = 'th'): string {
  if (error instanceof ZodError) {
    return pick(locale, {
      th: 'AI อ่านข้อมูลได้ไม่ครบ — ลองถ่ายรูปให้ชัดขึ้นหรือพิมพ์รายละเอียดเพิ่ม',
      en: "AI couldn't read everything — try a clearer photo or add more detail",
      zh: 'AI 未能完整读取 — 请拍得更清晰或补充更多细节',
    });
  }
  if (error instanceof Error && error.message.trim()) {
    const msg = error.message;
    if (/429|quota|rate.?limit|resource.?exhausted/i.test(msg)) {
      return pick(locale, {
        th: 'ตอนนี้มีคนใช้ AI เยอะ — รอสักครู่แล้วลองใหม่',
        en: 'AI is busy right now — wait a moment and try again',
        zh: 'AI 当前繁忙 — 请稍候再试',
      });
    }
    if (/no longer available|404 Not Found|models\/|api key|permission|ECONNREFUSED|fetch failed/i.test(msg)) {
      return pick(locale, AI_UNAVAILABLE_MESSAGE);
    }
    if (locale === 'th' && THAI_TEXT.test(msg) && msg.length <= 220) return msg;
  }
  return pick(locale, AI_FAILED_MESSAGE);
}
