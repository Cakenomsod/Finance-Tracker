import {
  formatLocalDateInput,
  type MonthSelection,
  getLocalMonthKey,
} from '@/lib/datetime'

/** ISO week number + ISO week-year (local timezone). */
export type WeekSelection = { year: number; week: number }

/** `YYYY-MM` for a month selection (0-indexed month, matches MonthSelection). */
export function formatMonthKey({ year, month }: MonthSelection): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

/** Parse `YYYY-MM` → MonthSelection (0-indexed month), or null if invalid. */
export function parseMonthKey(key: string): MonthSelection | null {
  const match = /^(\d{4})-(\d{2})$/.exec(key.trim())
  if (!match) return null
  const year = Number(match[1])
  const monthNum = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(monthNum)) return null
  if (monthNum < 1 || monthNum > 12) return null
  return { year, month: monthNum - 1 }
}

/** `YYYY-Www` ISO week key, e.g. `2026-W30`. */
export function formatWeekKey({ year, week }: WeekSelection): string {
  return `${year}-W${String(week).padStart(2, '0')}`
}

/** Parse `YYYY-Www` → WeekSelection, or null if invalid. */
export function parseWeekKey(key: string): WeekSelection | null {
  const match = /^(\d{4})-W(\d{1,2})$/i.exec(key.trim())
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (!Number.isInteger(year) || !Number.isInteger(week)) return null
  if (week < 1 || week > 53) return null
  return { year, week }
}

/**
 * Monday 00:00:00 – Sunday 23:59:59.999 for an ISO week (local timezone).
 * Week 1 is the week containing January 4.
 */
export function getWeekDateRange(sel: WeekSelection): { start: Date; end: Date } {
  const jan4 = new Date(sel.year, 0, 4)
  const jan4Day = jan4.getDay() || 7 // Mon=1 … Sun=7
  const mondayWeek1 = new Date(sel.year, 0, 4 - jan4Day + 1)
  mondayWeek1.setHours(0, 0, 0, 0)

  const start = new Date(mondayWeek1)
  start.setDate(mondayWeek1.getDate() + (sel.week - 1) * 7)
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return { start, end }
}

/** Convert a local date to its ISO week selection. */
export function dateToWeekSelection(date: Date): WeekSelection {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const day = local.getDay() || 7
  // Thursday of this week determines the ISO week-year
  const thursday = new Date(local)
  thursday.setDate(local.getDate() + 4 - day)
  const year = thursday.getFullYear()

  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const mondayWeek1 = new Date(year, 0, 4 - jan4Day + 1)
  mondayWeek1.setHours(0, 0, 0, 0)

  const thisMonday = new Date(local)
  thisMonday.setDate(local.getDate() - day + 1)
  thisMonday.setHours(0, 0, 0, 0)

  const week =
    Math.round((thisMonday.getTime() - mondayWeek1.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1

  return { year, week }
}

export function getCurrentWeekSelection(): WeekSelection {
  return dateToWeekSelection(new Date())
}

export function getPreviousWeekSelection(sel: WeekSelection): WeekSelection {
  const { start } = getWeekDateRange(sel)
  const prev = new Date(start)
  prev.setDate(prev.getDate() - 7)
  return dateToWeekSelection(prev)
}

export function getNextWeekSelection(sel: WeekSelection): WeekSelection {
  const { start } = getWeekDateRange(sel)
  const next = new Date(start)
  next.setDate(next.getDate() + 7)
  return dateToWeekSelection(next)
}

export function isSameWeekSelection(a: WeekSelection, b: WeekSelection): boolean {
  return a.year === b.year && a.week === b.week
}

export function isCurrentWeekSelection(sel: WeekSelection): boolean {
  return isSameWeekSelection(sel, getCurrentWeekSelection())
}

/** Unique ISO week keys that have at least one transaction date. */
export function listWeekKeysWithData(dates: Date[]): string[] {
  const keys = new Set<string>()
  for (const date of dates) {
    keys.add(formatWeekKey(dateToWeekSelection(date)))
  }
  return Array.from(keys).sort()
}

/** Unique month keys (`YYYY-MM`) that have at least one transaction date. */
export function listMonthKeysWithData(dates: Date[]): string[] {
  const keys = new Set<string>()
  for (const date of dates) {
    keys.add(getLocalMonthKey(date))
  }
  return Array.from(keys).sort()
}

/** Human-readable week label, e.g. "23–29 ก.ค. 2026". */
export function formatWeekLabel(sel: WeekSelection, locale = 'th-TH'): string {
  const { start, end } = getWeekDateRange(sel)
  const startLabel = start.toLocaleDateString(locale, { day: 'numeric', month: 'short' })
  const endLabel = end.toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
  return `${startLabel} – ${endLabel}`
}

export function weekRangeIso(sel: WeekSelection): { weekStart: string; weekEnd: string } {
  const { start, end } = getWeekDateRange(sel)
  return {
    weekStart: formatLocalDateInput(start),
    weekEnd: formatLocalDateInput(end),
  }
}

/** Number of ISO weeks in a week-year (52 or 53). */
export function getIsoWeeksInYear(isoYear: number): number {
  return dateToWeekSelection(new Date(isoYear, 11, 28)).week
}

export function hasWeekData(
  weeksWithData: ReadonlySet<string>,
  selection: WeekSelection
): boolean {
  return weeksWithData.has(formatWeekKey(selection))
}

function compareWeekSelection(a: WeekSelection, b: WeekSelection): number {
  if (a.year !== b.year) return a.year - b.year
  return a.week - b.week
}

export function getPreviousAvailableWeek(
  current: WeekSelection,
  available: ReadonlySet<string>
): WeekSelection | null {
  let best: WeekSelection | null = null
  for (const key of available) {
    const selection = parseWeekKey(key)
    if (!selection || compareWeekSelection(selection, current) >= 0) continue
    if (!best || compareWeekSelection(selection, best) > 0) best = selection
  }
  return best
}

export function getNextAvailableWeek(
  current: WeekSelection,
  available: ReadonlySet<string>
): WeekSelection | null {
  let best: WeekSelection | null = null
  for (const key of available) {
    const selection = parseWeekKey(key)
    if (!selection || compareWeekSelection(selection, current) <= 0) continue
    if (!best || compareWeekSelection(selection, best) < 0) best = selection
  }
  return best
}

/** Collect ISO week keys (`YYYY-Www`) from a list of dates. */
export function collectWeeksWithData(dates: Iterable<Date>): Set<string> {
  return new Set(listWeekKeysWithData([...dates]))
}
