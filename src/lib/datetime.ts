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
