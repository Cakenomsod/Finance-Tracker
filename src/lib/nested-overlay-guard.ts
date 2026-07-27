/** Shared activity mark for nested overlays (Select/Popover/Dropdown) inside Dialog. */

let lastAt = 0

export const NESTED_OVERLAY_ACTIVITY_SELECTORS = [
  '[data-slot="select-trigger"]',
  '[data-slot="select-content"]',
  '[data-slot="dropdown-menu-trigger"]',
  '[data-slot="dropdown-menu-sub-trigger"]',
  '[data-slot="dropdown-menu-content"]',
  '[data-slot="dropdown-menu-sub-content"]',
  '[data-slot="popover-trigger"]',
  '[data-slot="popover-content"]',
  '[data-slot="calendar"]',
] as const

export function markNestedOverlayActivity() {
  lastAt = Date.now()
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.nestedOverlayAt = String(lastAt)
  }
}

export function isCoarsePointer() {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches
}

export function getNestedOverlayGraceMs(
  event?: { pointerType?: string } | Event,
) {
  const pointerType =
    event && 'pointerType' in event && typeof event.pointerType === 'string'
      ? event.pointerType
      : undefined
  if (pointerType === 'touch' || isCoarsePointer()) {
    return 900
  }
  return 450
}

export function wasNestedOverlayRecentlyActive(ms?: number) {
  const grace = ms ?? getNestedOverlayGraceMs()
  const fromMemory = lastAt > 0 && Date.now() - lastAt < grace
  if (fromMemory) return true

  if (typeof document === 'undefined') return false
  const raw = document.documentElement.dataset.nestedOverlayAt
  if (!raw) return false
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return false
  return Date.now() - parsed < grace
}

export function isNestedOverlayActivityTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return NESTED_OVERLAY_ACTIVITY_SELECTORS.some((selector) =>
    target.closest(selector),
  )
}
