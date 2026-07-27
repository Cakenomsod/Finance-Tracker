# Impeccable polish — Transactions

**Target:** `src/app/(dashboard)/transactions/page.tsx` + `src/components/transactions/*`  
**Register:** product (Trusted Ledger)  
**Prior critique:** `.impeccable/critique/2026-07-02T01-56-30Z__src-app-dashboard-transactions-page-tsx.md` (26/40)  
**Quality bar:** flagship daily-capture surface  
**Status:** DONE

## Drift named → fixed

| Issue | Root cause | Fix |
|-------|------------|-----|
| Month picker didn’t filter the list (P0) | Conceptual misalignment — summary used `filterByMonth`, list did not | Scope list to selected month; auto-`loadOlder` when month exists in full data but not yet in window |
| Four staggered summary cards (P1) | One-off hero-metric grid vs dashboard single-card pattern | One sticky `Card` with internal 2×2 / 4-col stats; no nested cards; no stagger |
| Missing `tabular-nums` on summary | One-off omission | All summary amounts use `tabular-nums` + `amountColorClass` |
| Choreographed stagger (0/45/90/135ms) | Decorative motion | Removed; month transitions capped at ~200ms via class override; `motion-reduce` retained |
| Hover-only row ⋯ without label (P2) | Incomplete interaction states | `aria-label`; `focus-within` / always-visible on touch; 44px mobile menu target |
| EN/TH mix (“Trip Expense”, “Me”) | Copy drift | Thai labels: รายจ่ายทริป, ฉัน; detail dialog split modes Thai |
| Emoji note prefix / uppercase eyebrows | Anti-pattern leftovers | Plain note text; section labels without uppercase tracking |
| Empty/loading density | Incomplete states | `no-month-data` variant; denser table/mobile skeletons matching list chrome |

## What changed

### Hierarchy & IA
- Month picker and list now share the same month scope (date groups only — month dividers dropped while single-month view is active).
- Sticky summary is one composition: income / expense / net / cumulative balance.
- Summary stats use hairline `border-border` dividers (vertical on desktop 4-col; right + bottom on mobile 2×2) — not side-stripes or nested cards. Sticky bar also separates picker from the summary card with a light divider.
- Result count line under summary (`N รายการในเดือนนี้`).
- Clear-filters control when search or category is active.

### Density & responsive
- Desktop table: tighter `py-2.5` rows, compact date dividers.
- Mobile list: `rounded-xl` + `shadow-sm`, `px-3 py-3` rows, day groups without redundant month headers.
- Desktop “เพิ่มธุรกรรม” in filter bar; mobile relies on existing FAB.

### Motion
- Page-level: 150–200ms color/opacity transitions; no load choreography.
- Shared `MonthContentTransition` / `MonthAnimatedValue` overridden with `duration-200 ease-out` (no shared-file edit); `motion-reduce:animate-none` retained via shared components. No staggered cell entrance.

### A11y
- Search / category / row-menu / FAB labels.
- Empty state `role="status"`; skeletons `aria-busy`; load-older `aria-live`.
- Infinite-scroll sentinel and windowed fetch logic preserved (including month-driven older loads).

### Files touched
- `src/app/(dashboard)/transactions/page.tsx`
- `src/components/transactions/transaction-mobile-list.tsx`
- `src/components/transactions/transaction-empty-state.tsx`
- `src/components/transactions/transaction-list-skeleton.tsx`
- `src/components/transactions/transaction-detail-dialog.tsx`
- `src/components/transactions/date-group-divider.tsx`
- `src/components/transactions/transaction-form.tsx` (receipt items label only)

### Intentionally not edited
- `src/components/ui/*`, `globals.css`, `DESIGN.md`, `PRODUCT.md`
- Shared `month-transition.tsx` / `month-picker` (page overrides duration)
- `AiExpenseQuickInput` (shared; still signature inline capture)
- Delete confirmation (harden follow-up)
- `month-group-divider.tsx` left in tree for possible multi-month reuse

## Checklist

- [x] Aligned to DESIGN.md (tabular money, restrained mint, no nested metric cards / gradient text / side-stripes)
- [x] Month IA matches picker
- [x] Loading skeletons (not blank spinners)
- [x] Empty states teach next action
- [x] Interactive states + labels
- [x] Reduced motion respected on page transitions
- [x] Infinite scroll / windowed data preserved
- [x] Detector clean on target paths
- [x] Typecheck clean (`tsc --noEmit`)

## Follow-ups (out of polish scope)

- Delete confirmation dialog
- Collapsible AI panel for first-viewport density
- Tooltip help for Paotang quota / trip debt pending
