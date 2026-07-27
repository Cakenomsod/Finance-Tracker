# Impeccable polish — Debts

**Target:** `src/app/(dashboard)/debts/page.tsx`  
**Register:** product  
**Quality bar:** flagship (settlement is a core social-money flow)  
**Date:** 2026-07-27

## Drift named

| Issue | Root cause | Fix |
|---|---|---|
| Summary cards used gradient fills + AlertCircle “owe” framing | One-off implementation / anti-reference drift | Flat `shadow-sm` cards; red/mint semantic ink only; Send/Wallet icons |
| “Loading debts...” plain text | Missing pattern vs dashboard/transactions | Page-local `DebtsSkeleton` |
| Empty tabs were one-line muted text | Conceptual misalignment with teaching empty states | `DebtEmptyState` with next action |
| Dashed “quick add” card under summaries | Extra chrome / ceremony | Primary **Record Debt** in page header |
| History amounts: mobile `text-primary`, desktop `text-success` | Inconsistent token use | Both use `text-success` / `text-destructive` |
| Money without consistent `tabular-nums` on summaries | Missed Tabular Money Rule | `formatDebtAmount` + `tabular-nums` everywhere |
| Settle dialog weak who-owes hierarchy | Flow chrome, not logic | Remaining-balance strip + labeled amount + direction copy |

Settlement / debt payment handlers (`handleConfirmSettle`, trip allocation, reverse payment) were **not** changed.

## What changed

1. **Hierarchy** — Title + cooperative Thai subtitle; primary CTA in header; three calm summary totals; tabs; lists.
2. **Semantic lock** — You owe = destructive (Alert Red); owed to you / received = success (Cooperative Mint); net via `amountColorClass`.
3. **Tabs** — Wrap-friendly list, count badges with `tabular-nums` + `aria-label`, fade-in content with `motion-reduce:animate-none`.
4. **Tables / mobile rows** — Clear เจ้าหนี้/ลูกหนี้ labeling, keyboard-activatable rows when linked to a transaction, larger touch targets on settle/more.
5. **Dialogs** — Add debt: direction-aware person label, disabled Save until valid. Settle: remaining balance, partial-pay helpers, loading state preserved.
6. **Motion** — 150–250ms (`duration-200`); summary stagger ≤80ms; all gated with `motion-reduce:animate-none` / `motion-reduce:transition-none`.
7. **A11y** — Skeleton `aria-busy`, labeled inputs, menu `aria-label`s, focus-visible on clickable rows.

## Explicitly avoided

- Gradient text, side-stripes, nested cards, warm cream canvas
- Shared UI kit / `globals.css` / DESIGN.md / PRODUCT.md / other pages
- Playful fintech (confetti, gamified badges, confrontational AlertCircle hero)

## Checklist (polish.md)

- [x] Aligned to DESIGN.md semantic colors & card vocabulary  
- [x] IA matches product flows (header CTA, tabs, settle modal)  
- [x] Interactive states (hover/focus/disabled/loading) on key actions  
- [x] Empty + loading states teach or skeleton  
- [x] Touch targets ≥40px on primary mobile actions  
- [x] `prefers-reduced-motion` respected  
- [x] Logic preserved  

## Follow-ups (out of scope)

- Friend picker for “Person Name” instead of free text (needs shared contacts UI)
- Shared empty-state primitive if more pages adopt the same pattern
