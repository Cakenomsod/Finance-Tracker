/** Per-device memory of the user's last choices so repeat entries need fewer taps. */

type MemoryKey =
  | 'category:expense'
  | 'category:income'
  | 'account'

const PREFIX = 'ft:last:'

function storageKey(uid: string | null | undefined, key: MemoryKey): string | null {
  if (!uid) return null
  return `${PREFIX}${uid}:${key}`
}

export function readLastUsed(uid: string | null | undefined, key: MemoryKey): string | null {
  const k = storageKey(uid, key)
  if (!k || typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(k)
  } catch {
    return null
  }
}

export function writeLastUsed(
  uid: string | null | undefined,
  key: MemoryKey,
  value: string | null | undefined
): void {
  const k = storageKey(uid, key)
  if (!k || typeof window === 'undefined' || !value) return
  try {
    window.localStorage.setItem(k, value)
  } catch {
    // Storage full or blocked (private mode) — memory is a convenience only.
  }
}
