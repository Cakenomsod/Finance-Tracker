import { getLocalTimeInput, getLocalTodayIso } from '@/lib/datetime';
import type { ReceiptParseResult } from '@/lib/ai/receipt-schema';

const DEFAULT_TZ = 'Asia/Bangkok';

export function aiTimeZoneFromContext(context?: {
  countryCode?: string;
  currency?: string;
}): string {
  if (context?.countryCode === 'JP' || context?.currency === 'JPY') return 'Asia/Tokyo';
  return DEFAULT_TZ;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function toGregorianYear(year: number): number {
  return year >= 2400 ? year - 543 : year;
}

/** Normalize AI date output to YYYY-MM-DD in the app timezone. */
export function normalizeAiDate(raw?: string, timeZone = DEFAULT_TZ): string {
  const today = getLocalTodayIso(timeZone);
  if (!raw?.trim()) return today;

  const s = raw.trim();

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const year = toGregorianYear(parseInt(iso[1], 10));
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (isValidDateParts(year, month, day)) return formatIsoDate(year, month, day);
  }

  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (dmy) {
    let day = parseInt(dmy[1], 10);
    let month = parseInt(dmy[2], 10);
    let year = parseInt(dmy[3], 10);
    if (year < 100) year += 2000;
    year = toGregorianYear(year);
    if (day <= 12 && month > 12) [day, month] = [month, day];
    if (isValidDateParts(year, month, day)) return formatIsoDate(year, month, day);
  }

  const ymd = s.match(/^(\d{4})[/.-](\d{1,2})[/.-](\d{1,2})$/);
  if (ymd) {
    const year = toGregorianYear(parseInt(ymd[1], 10));
    const month = parseInt(ymd[2], 10);
    const day = parseInt(ymd[3], 10);
    if (isValidDateParts(year, month, day)) return formatIsoDate(year, month, day);
  }

  return today;
}

function parseThaiTime(raw: string): string | null {
  const t = raw.trim();

  const toem = t.match(/(\d{1,2})\s*ทุ่ม(?:\s*(\d{1,2}))?/);
  if (toem) {
    const h = 18 + parseInt(toem[1], 10);
    const m = toem[2] ? parseInt(toem[2], 10) : 0;
    if (h >= 19 && h <= 23) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const tee = t.match(/ตี\s*(\d{1,2})(?:\s*(\d{1,2}))?/);
  if (tee) {
    const h = parseInt(tee[1], 10);
    const m = tee[2] ? parseInt(tee[2], 10) : 0;
    if (h >= 1 && h <= 5) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const bai = t.match(/บ่าย\s*(\d{1,2})(?:\s*(\d{1,2}))?/);
  if (bai) {
    const h = 12 + parseInt(bai[1], 10);
    const m = bai[2] ? parseInt(bai[2], 10) : 0;
    if (h >= 13 && h <= 17) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  const mong = t.match(/(\d{1,2})\s*โมง(?:\s*(\d{1,2}))?/);
  if (mong) {
    let h = parseInt(mong[1], 10);
    const m = mong[2] ? parseInt(mong[2], 10) : 0;
    if (/เช้า/.test(t) && h >= 6 && h <= 11) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (/เย็น/.test(t) && h >= 1 && h <= 6) {
      h += 17;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    if (h >= 1 && h <= 11) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  return null;
}

/** Normalize AI time output to HH:mm; falls back to current local time. */
export function normalizeAiTime(raw?: string, timeZone = DEFAULT_TZ): string {
  if (!raw?.trim()) return getLocalTimeInput(timeZone);

  const t = raw.trim();

  const thai = parseThaiTime(t);
  if (thai) return thai;

  const ampm = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = ampm[2];
    if (ampm[3].toLowerCase() === 'pm' && h < 12) h += 12;
    if (ampm[3].toLowerCase() === 'am' && h === 12) h = 0;
    return `${String(Math.min(23, h)).padStart(2, '0')}:${m}`;
  }

  const hms = t.match(/^(\d{1,2}):(\d{2})/);
  if (hms) {
    return `${String(Math.min(23, parseInt(hms[1], 10))).padStart(2, '0')}:${hms[2]}`;
  }

  return getLocalTimeInput(timeZone);
}

export function normalizeReceiptDateTime(
  parsed: ReceiptParseResult,
  timeZone = DEFAULT_TZ
): ReceiptParseResult {
  return {
    ...parsed,
    date: normalizeAiDate(parsed.date, timeZone),
    time: normalizeAiTime(parsed.time, timeZone),
  };
}

/** Hint for AI prompts — anchors "today" and default time to Thailand local. */
export function buildAiDateContext(timeZone = DEFAULT_TZ): string {
  const today = getLocalTodayIso(timeZone);
  const now = getLocalTimeInput(timeZone);
  return `\nReference (timezone ${timeZone}): today is ${today}, current local time is ${now}. Use this when the user says "today"/"วันนี้" or does not specify date/time.`;
}
