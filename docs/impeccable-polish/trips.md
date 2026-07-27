# Impeccable polish — Trips list

**Surface:** `src/app/(dashboard)/trips/page.tsx` (list only)  
**Related:** `src/components/trips/member-picker.tsx`, `src/components/trips/trip-settings-fields.tsx`  
**Register:** product · Trusted Ledger  
**Date:** 2026-07-27  
**Status:** DONE

## Goals

Align the trips list with DESIGN.md: clarity on group costs, restrained Cooperative Mint, no SaaS icon-card grid cliché, keyboard-friendly cards, teaching empty states, and 150–250ms motion with `prefers-reduced-motion`.

## Drift addressed

| Issue | Root cause | Fix |
| --- | --- | --- |
| Three identical icon + metric cards | Conceptual misalignment (banned identical icon-card grid) | Single overview strip: one surface, three ledger columns with dividers |
| Nested muted “cards” inside trip cards | One-off implementation | Flat border-y ledger for totals; bordered divide-y lists for settlements/expenses |
| Centered Plane pulse loader | Missing system pattern | Page skeleton matching header / strip / cards |
| Click-only trip cards; Add expense bubbled to navigate | Interaction gap | `role="link"` + keyboard Enter/Space; `stopPropagation` on menu, expense, and add |
| Empty states as dashed cards with vague copy | Copy / IA | Teaching empty panels with next action CTA |
| Create dialog labels mixed / unlabeled | Consistency | `htmlFor` + ids; bilingual helpers; fieldset for currency (no nested muted box) |
| Member chips as pills without a11y | Interaction gap | `aria-pressed`, remove labels, focus rings, 150ms transitions |
| Positive balance used `text-success` | Token consistency | Cooperative Mint via `text-primary` for “owed to you” |

## What changed

### List page
- Title **Trips** with clearer group-cost subtitle
- Overview strip (active count · trip expenses ฿ · people) — not three icon cards
- Trip cards: status badge, dates, total vs your balance with tabular-nums and owed/owe/settled labels
- Settlements and recent expenses as flat lists (no icon wells / nested rounded panels)
- Skeleton loading; tab content fade-in 200ms + `motion-reduce:animate-none`
- Create dialog: loading state on submit; form reset on close; labeled fields
- Responsive padding (`p-4 sm:p-6`); full-width primary CTA on mobile

### Member picker / settings fields
- Contact pickers: rounded-md (not playful pills), pressed state, bilingual helper labels
- Trip settings: `fieldset` + border-t section instead of nested muted card box

## Preserved

- Trip create / close / reopen / delete flows
- Balance and settlement calculation logic
- Add expense → `saveTripExpenseWithTransaction`
- Transaction detail edit path

## Out of scope

- `src/app/(dashboard)/trips/[tripId]/page.tsx` (owned by another agent)
- `src/components/ui/*`, `globals.css`, DESIGN.md, PRODUCT.md

## Checklist

- [x] Aligned to design system (Cool Paper, One Voice, Tabular Money, Subtle Lift)
- [x] No gradient text, side-stripes, nested cards, warm cream, playful fintech
- [x] No identical icon-card stats grid
- [x] Interactive states + focus rings on trip cards / menu / expense rows
- [x] Empty + loading states teach or skeleton
- [x] Motion 150–200ms with reduced-motion alternatives
- [x] CRUD logic unchanged in behavior
- [x] Detector clean on touched files (`[]`)
