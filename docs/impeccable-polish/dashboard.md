# Dashboard polish — Trusted Ledger

**Surface:** `src/app/(dashboard)/dashboard/page.tsx`  
**Register:** product  
**Quality bar:** flagship  
**Date:** 2026-07-27

## Problems found

1. **Decorative chrome** — Recurring dues used a leftward amber gradient and icon well; income chart overlay used glass (`backdrop-blur` + translucent fill).
2. **SaaS / hero-metric tropes** — Four identical muted tiles with oversized bold numbers for “Financial Habits”; duplicate category pie + ranking cards showing the same data twice.
3. **Dead control** — Outline Download icon button with no handler or label.
4. **Weak empty states** — Icon + “No transaction data” without a next action; debt card always showed zero rows; chart empties were terse and non-teaching.
5. **Hierarchy & copy drift** — Generic “Financial overview…” subtitle; “Debt Summary” / “View All” casing inconsistent; mint-heavy debt wells (`bg-primary/10` / `bg-destructive/10` large fills).
6. **Money formatting** — Hardcoded `฿` in category lists instead of `formatMoney` / profile currency; habits amounts not using shared formatter.
7. **Motion** — Decorative staggered `animate-in` on habit tiles (page-load choreography); not state-only.
8. **Chart readability / a11y** — Dense grid strokes, cramped Y ticks, scroll region lacking keyboard/`aria` affordances; skeleton layout lagged the real page.
9. **Nested-card feel** — Recurring items as bordered `bg-background/80` boxes inside the card.

## Changes made

### `src/app/(dashboard)/dashboard/page.tsx`
- Sharper page header copy tied to selected month; removed non-functional Download.
- Teaching empty month state with Quick Add + link to transactions.
- Merged category pie + ranking into one card (donut + ranked progress list).
- Paired weekly + daily charts in a two-column grid; clearer empty copy.
- Replaced habit tiles with a compact definition-list ledger (no identical big-number grid, no entrance stagger).
- `formatMoney` for category amounts; sentence-case section titles; `text-balance` / `text-pretty`.

### `src/components/dashboard/recurring-due-card.tsx`
- Dropped gradient and icon well; warning border/tint only.
- List as divided rows (no nested card boxes); a11y on busy actions.

### `src/components/dashboard/debt-summary-card.tsx`
- Quieter muted wells; color reserved for amounts/icons.
- Empty state with CTA to `/debts`; clearer “Shared balances” copy.

### `src/components/dashboard/monthly-summary-card.tsx`
- Ledger-weight balance (`font-semibold`); tighter labels; `aria` group for secondary stats; tabular change badges.

### `src/components/dashboard/dashboard-skeleton.tsx`
- Skeleton mirrors balance → debts → chart/insights → category layout.

### `src/components/analytics/insights-panel.tsx`
- Removed Sparkles icon well; divided insight list; dashed empty state; quieter labels.

### `src/components/analytics/income-expenses-scroll-chart.tsx`
- Removed glass overlay; solid bordered hint; scroll region `role`/`aria-label`/`tabIndex`; clearer Y ticks; live status for loading older months.

## Follow-ups

- `MonthContentTransition` / `MonthAnimatedValue` in `src/components/shared/month-transition.tsx` still use `duration-300` (outside polish scope). Align to 150–250ms product motion when shared is next touched.
- Chart axis tickers still hardcode `฿` in Recharts formatters; consider a shared tick formatter that respects profile currency.
- Progress root in `ui/progress` uses primary mint track; category bars inherit that — acceptable for now; optional neutral track token later.
- Bilingual: dashboard section copy is English-only; wire through `useLocale` / i18n keys when Thai dashboard strings are prioritized.
- Visual QA in browser (light/dark, mobile bottom nav, month switch) when a logged-in session is available.

## Status

**DONE**
