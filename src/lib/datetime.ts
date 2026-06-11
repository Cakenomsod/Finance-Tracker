import type { Timestamp } from 'firebase/firestore'

export type FirestoreDateLike =
  | Timestamp
  | { seconds: number; nanoseconds?: number }
  | null
  | undefined

/** Convert Firestore Timestamp (or serialized `{ seconds }`) to a JS Date. */
export function toDateFromFirestore(value: FirestoreDateLike): Date | null {
  if (!value) return null
  if (typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate()
  }
  if ('seconds' in value && typeof value.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return null
}

/** `YYYY-MM-DD` in the user's local timezone (for `<input type="date">`). */
export function formatLocalDateInput(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** `HH:mm` in the user's local timezone (for `<input type="time">`). */
export function formatLocalTimeInput(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/** Parse date + time entered in local fields into a Date. */
export function parseLocalDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`)
}

/** Short date for transaction lists (e.g. "Jun 11"). */
export function formatTransactionDisplayDate(
  date: Date,
  locale = 'en-US'
): string {
  return date.toLocaleDateString(locale, {
    month: 'short',
    day: 'numeric',
  })
}

/** Time for transaction lists (e.g. "14:30"). */
export function formatTransactionDisplayTime(date: Date): string {
  return date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Milliseconds from a Firestore date field; `0` when missing. */
export function timestampMillis(value: FirestoreDateLike): number {
  const date = toDateFromFirestore(value)
  return date ? date.getTime() : 0
}

/** `YYYY-MM-DD` in local timezone — stable key for grouping by calendar day. */
export function getLocalDateKey(date: Date): string {
  return formatLocalDateInput(date)
}

/** Human-readable section label for date-grouped lists. */
export function formatDateGroupLabel(date: Date, locale = 'th-TH'): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const key = getLocalDateKey(date)
  if (key === getLocalDateKey(today)) return 'วันนี้'
  if (key === getLocalDateKey(yesterday)) return 'เมื่อวาน'

  return date.toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export interface DateGroupedItems<T> {
  dateKey: string
  date: Date
  label: string
  items: T[]
}

/** Sort items by date descending, then group by local calendar day. */
export function groupItemsByDate<T>(
  items: T[],
  getDate: (item: T) => Date | null,
  locale = 'th-TH'
): DateGroupedItems<T>[] {
  const sorted = [...items].sort((a, b) => {
    const aTime = getDate(a)?.getTime() ?? 0
    const bTime = getDate(b)?.getTime() ?? 0
    return bTime - aTime
  })

  const groups: DateGroupedItems<T>[] = []
  for (const item of sorted) {
    const date = getDate(item)
    const dateKey = date ? getLocalDateKey(date) : 'unknown'
    const last = groups[groups.length - 1]

    if (last && last.dateKey === dateKey) {
      last.items.push(item)
      continue
    }

    groups.push({
      dateKey,
      date: date ?? new Date(0),
      label: date ? formatDateGroupLabel(date, locale) : 'ไม่ระบุวันที่',
      items: [item],
    })
  }

  return groups
}
