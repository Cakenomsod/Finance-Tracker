# Impeccable polish — Trip detail

**Target:** `src/app/(dashboard)/trips/[tripId]/page.tsx`  
**Related:** `trip-expense-list.tsx`, `trip-expense-form.tsx`, `trip-ai-panel.tsx`, `trip-expense-dialog.tsx`, `ai-expense-quick-input.tsx`  
**Register:** product (Trusted Ledger)  
**Date:** 2026-07-27  
**Status:** DONE

## Goals

Align the trip detail surface with DESIGN.md: clear balances/settlements, AI capture as first-class, tabular money, restrained Cooperative Mint, no playful-fintech chrome. Preserve expense sync, Immich, and settlement logic.

## Drift found & fixed

| Issue | Root cause | Fix |
| --- | --- | --- |
| Centered plane spinner on load | One-off vs system skeleton pattern | `TripDetailSkeleton` with card-shaped placeholders |
| Summary ignored “your balance”; hard-coded ฿ | Conceptual misalignment + incomplete money formatting | Your-balance card with semantic colors; `homeSymbol` + `tabular-nums` |
| Emoji split labels / celebration empty states | Playful-fintech anti-reference | Plain Solo/Equal/Custom labels; icon + teaching empty copy |
| `rounded-full` payer chips, uppercase eyebrows | AI-slop / badge drift | `rounded-md` chips with `aria-pressed`; sentence-case section labels |
| Nested card feel in mobile expense list | Card wrapping bordered `bg-card` groups | Flattened date sections + single border divide list |
| Row actions hover-only (`opacity-0`) | Interaction / a11y gap | Always visible on mobile; desktop show on hover **and** focus-within |
| Settlement viz: weak who→whom, green-500 | Token inconsistency | Explicit “pays / owes”, `text-success`, bordered transfer rows |
| Empty states as muted one-liners | Missing teach-next-action | CTA empty states (add expense, clear filters, settlement guidance) |
| Dialogs cramped on mobile | One-off vs dialog pattern | Match `max-sm:top-[4vh]` + `min(90vh,90dvh)` used elsewhere |
| AI panel looked secondary | Signature AI not elevated | `rounded-xl shadow-sm`, mint icon well, clearer hierarchy + job status |

## What stayed untouched

- Expense ↔ transaction sync (`save` / `update` / `deleteTripExpenseWithTransaction`)
- Immich attach / delete flows
- Settlement greedy algorithm, itemized debt pool, `recordSettlement`
- Trips **list** page (`trips/page.tsx`)
- `src/components/ui/*`, `globals.css`, DESIGN.md, PRODUCT.md

## Checklist

- [x] Aligned to DESIGN.md (no gradient text, side-stripes, nested cards, warm cream)
- [x] Balances / settlements clearer (your balance + settlement plan copy)
- [x] AI capture first-class above tabs
- [x] `tabular-nums` on money amounts
- [x] Skeleton loading; teaching empty states
- [x] Motion 150–250ms with `motion-reduce:animate-none`
- [x] Touch / focus / aria labels improved on key controls
- [x] Sync / Immich / settlement logic preserved

## Follow-up — Settle mobile overflow (2026-08-06)

| Issue | Root cause | Fix |
| --- | --- | --- |
| Settle rows spill past phone edges | Horizontal flex: avatars + long Thai names + amount + button in one row; `truncate` fails without width budget | Stack who→whom / amount+action; `[overflow-wrap:anywhere]`; tighter mobile card padding (`px-4`); `min-w-0 overflow-hidden` on cards |
| Tabs / page can force overflow | Missing `min-w-0` on flex/grid ancestors | Page + Tabs + TabsTriggers get `min-w-0`; compact tab padding on xs |

Logic untouched (settlement algorithm, record payment, itemized debt states).

