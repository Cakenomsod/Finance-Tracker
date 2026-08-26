import { getLocalTodayIso } from '@/lib/datetime';

/** HH:mm or H.mm / ตอน 12.02 */
const TIME_PATTERN = /(?:ตอน\s*)?(\d{1,2})[.:](\d{2})(?!\d)/;

/** Amount-ish number in the line (not only a time). */
const AMOUNT_PATTERN = /(?:^|[^\d.:])(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)(?:\s*(?:บาท|บ|฿|baht|\$|¥|€))?/i;

const DATE_MARKER_PATTERN =
  /ทั้งหมดนี้\s*วันที่|วันที่\s*\d{1,2}|^วัน(?:ที่)?\s*\d{1,2}/i;

const MONTH_MAP: Record<string, number> = {
  'ม.ค.': 1,
  มค: 1,
  มกราคม: 1,
  'ก.พ.': 2,
  กพ: 2,
  กุมภาพันธ์: 2,
  'มี.ค.': 3,
  มีค: 3,
  มีนาคม: 3,
  'เม.ย.': 4,
  เมย: 4,
  เมษายน: 4,
  'พ.ค.': 5,
  พค: 5,
  พฤษภาคม: 5,
  'มิ.ย.': 6,
  มิย: 6,
  มิถุนายน: 6,
  'ก.ค.': 7,
  กค: 7,
  กรกฎาคม: 7,
  'ส.ค.': 8,
  สค: 8,
  สิงหา: 8,
  สิงหาคม: 8,
  'ก.ย.': 9,
  กย: 9,
  กันยายน: 9,
  'ต.ค.': 10,
  ตค: 10,
  ตุลาคม: 10,
  'พ.ย.': 11,
  พย: 11,
  พฤศจิกายน: 11,
  'ธ.ค.': 12,
  ธค: 12,
  ธันวาคม: 12,
};

export interface ExpenseTextSegment {
  text: string;
  /** YYYY-MM-DD when known from a date-block marker */
  dateHint?: string;
}

export function extractTimeFromLine(line: string): string | null {
  const m = line.match(TIME_PATTERN);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

export function isDateMarkerLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (DATE_MARKER_PATTERN.test(t)) return true;
  // "25 สิงหา 69" / "26 ส.ค. 2569" alone
  return /^(?:วันที่\s*)?\d{1,2}\s+\S+\s+\d{2,4}$/.test(t) && /[ก-๙]/.test(t);
}

export function parseThaiDateMarker(line: string, timeZone = 'Asia/Bangkok'): string | null {
  const t = line.trim();
  const today = getLocalTodayIso(timeZone);

  // day + month name + year
  const named = t.match(/(\d{1,2})\s*([ก-๙.]+)\s*(\d{2,4})/);
  if (named) {
    const day = parseInt(named[1], 10);
    const monthKey = named[2].replace(/\s+/g, '');
    let month: number | undefined;
    for (const [k, v] of Object.entries(MONTH_MAP)) {
      if (monthKey.startsWith(k) || k.startsWith(monthKey)) {
        month = v;
        break;
      }
    }
    if (!month) return null;
    let year = parseInt(named[3], 10);
    if (year < 100) year += 2500; // 69 → 2569 BE
    if (year >= 2400) year -= 543;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // ISO already
  const iso = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return today.includes('-') ? null : null;
}

function lineHasAmount(line: string): boolean {
  // Strip times first so "09.00" alone is not treated as amount-only event
  const withoutTime = line
    .replace(/\d{1,2}[.:]\d{2}/g, ' ')
    .replace(/ตอน\s*/gi, ' ');
  return AMOUNT_PATTERN.test(withoutTime);
}

export function looksLikeEventLine(line: string): boolean {
  const t = line.trim();
  if (!t || isDateMarkerLine(t)) return false;
  if (/^(?:รวม|ยอดรวม|ทั้งหมด|total)\b/i.test(t) && !/โอน|จ่าย|เข้า|ออก/.test(t)) {
    return false;
  }
  return lineHasAmount(t) || /โอน|เงินเข้า|เงินออก|นั่ง|จ่าย|ข้าว|กาแฟ|รถ/.test(t);
}

/**
 * True when the pasted text is a multi-event journal (esp. different times),
 * so we must NOT let the model collapse it into one receipt with items[].
 */
export function shouldForceLineSplit(text: string): boolean {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;

  const eventLines = lines.filter(looksLikeEventLine);
  if (eventLines.length < 2) return false;

  const times = new Set(
    eventLines.map(extractTimeFromLine).filter((t): t is string => Boolean(t))
  );
  if (times.size >= 2) return true;

  // Mixed income/transfer/expense across lines → split even without times
  const kinds = eventLines.map((l) => {
    if (/โอน.*เข้า|เงินเข้า|ให้เงิน|ลูกค้าโอน|received|income|salary/i.test(l)) return 'income';
    if (/โอนจาก|โอน.*ไป|โอนเงินออก|transfer/i.test(l)) return 'transfer';
    return 'expense';
  });
  if (new Set(kinds).size >= 2) return true;

  // Multi-line diary with 3+ event lines → split (user journal style)
  if (eventLines.length >= 3) return true;

  return false;
}

/**
 * Split journal text into one segment per event line.
 * Date markers ("ทั้งหมดนี้วันที่ …") apply to the preceding block.
 */
export function splitExpenseTextIntoSegments(
  text: string,
  timeZone = 'Asia/Bangkok'
): ExpenseTextSegment[] {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim());
  const segments: ExpenseTextSegment[] = [];
  let pending: string[] = [];

  const flush = (dateHint?: string) => {
    for (const line of pending) {
      if (looksLikeEventLine(line)) {
        segments.push({ text: line, dateHint });
      }
    }
    pending = [];
  };

  for (const line of rawLines) {
    if (!line) continue;
    if (isDateMarkerLine(line)) {
      const dateHint = parseThaiDateMarker(line, timeZone) ?? undefined;
      flush(dateHint);
      continue;
    }
    pending.push(line);
  }
  flush(undefined);

  return segments.length > 0 ? segments : [{ text: text.trim() }];
}
