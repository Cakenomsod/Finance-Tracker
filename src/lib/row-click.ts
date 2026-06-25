/** Returns true when the click target is an interactive control inside a list row. */
export function shouldIgnoreRowClick(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return !!target.closest(
    'button, a, input, textarea, select, [role="checkbox"], [role="menuitem"], [data-row-click-ignore]'
  )
}
