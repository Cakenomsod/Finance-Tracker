---
target: Analytics
total_score: 21
p0_count: 0
p1_count: 3
p2_count: 2
timestamp: 2026-06-26T05-50-27Z
slug: src-app-dashboard-analytics-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Month transitions animate well; loading is a centered spinner (not skeleton); `error` from `useAnalyticsData` is never surfaced |
| 2 | Match System / Real World | 2 | "Cash Flow Overview" implies multi-month trend but data is month-scoped; weekday chart uses `thisWeek` key for monthly totals |
| 3 | User Control and Freedom | 3 | MonthPicker with data-aware navigation is solid; no way to clear month filter or compare periods side-by-side |
| 4 | Consistency and Standards | 2 | Dashboard uses `formatMoney`, `tabular-nums`, and user currency; Analytics hardcodes `฿` and omits tabular nums on hero amounts |
| 5 | Error Prevention | 2 | Download icon button is visible but has no handler — invites a dead-end click |
| 6 | Recognition Rather Than Recall | 2 | Category data appears three times (pie legend, ranking list, habits summary); users must mentally dedupe |
| 7 | Flexibility and Efficiency | 2 | No export, no drill-down from category to transactions, no MoM deltas like Dashboard |
| 8 | Aesthetic and Minimalist Design | 2 | Seven card sections on one scroll; four hero stat cards + redundant charts compete for attention |
| 9 | Error Recovery | 1 | Firestore listener errors log to console only; page shows stale or empty data with no recovery path |
| 10 | Help and Documentation | 2 | Empty state suggests actions but offers no button/link to add a transaction |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Not classic AI slop (no gradient text, side stripes, or section eyebrows). It does hit the PRODUCT.md anti-reference of generic SaaS dashboards: four identical stat cards at the top, a card grid of charts, and repeated metric tiles. The page reads as "dashboard generator output" rather than a purpose-built analytics surface. Staggered `animate-in` on every stat card and habits tile is decorative motion that violates the design system's state-only motion rule. A user fluent in Stripe or Linear would pause at the duplicate category sections and the inert download control.

**Deterministic scan:** `detect.mjs` on `src/app/(dashboard)/analytics/page.tsx` returned **0 findings** (exit 0). No automated antipattern hits in markup.

**Browser visualization:** Navigated to `http://localhost:3000/analytics` — redirected to login (`/login?from=%2Fanalytics`). No reliable user-visible overlay on the Analytics surface; assessment relied on source review and login-page screenshot only.

## Overall Impression

Analytics has real data plumbing and shares the app's MonthPicker / chart vocabulary, but the page tries to show everything at once and repeats itself. The single biggest opportunity is to **distill**: one clear story per scroll (summary → where money went → when → habits), eliminate duplicate category views, and align money formatting with Dashboard.

## What's Working

1. **Month-scoped data hook** — `useAnalyticsData` correctly windows Firestore queries by month; month auto-snaps to latest month with data.
2. **Motion accessibility** — `MonthContentTransition`, `MonthAnimatedValue`, and stat cards all include `motion-reduce:animate-none`.
3. **Semantic color usage** — Income/expense/savings use success/destructive/mint consistently; chart tokens map to design system.

## Priority Issues

### [P1] Cash Flow chart misrepresents the time range
- **Why it matters:** Users expect "Overview" to show a trend. With month-filtered data, `buildMonthlyOverview` often renders a single point — an area chart with one month is visually empty and misleading.
- **Fix:** Either fetch multi-month data for this chart (like Dashboard's scroll chart) or rename/replace with a month-scoped visualization (income vs expense bar for the selected month).
- **Suggested command:** `/impeccable distill`

### [P1] Download button is a dead control
- **Why it matters:** Icon-only button with no `onClick`, no `aria-label`, no tooltip — fails both affordance and accessibility (Sam can't identify it; Alex clicks and nothing happens).
- **Fix:** Implement CSV/PDF export or remove until ready; add `aria-label="Export analytics"`.
- **Suggested command:** `/impeccable harden`

### [P1] Category breakdown is shown twice
- **Why it matters:** Pie + top-5 legend and a separate "Category Ranking" card with progress bars show the same data. Extraneous cognitive load; users wonder which is authoritative.
- **Fix:** Keep one visualization (ranked bars with percentages OR donut with compact legend). Move "view all categories" behind expansion if needed.
- **Suggested command:** `/impeccable distill`

### [P2] No error state for failed data loads
- **Why it matters:** `useAnalyticsData` exposes `error` but the page ignores it. Riley sees a blank or partial page after a Firestore failure with no retry.
- **Fix:** Inline error card with retry button, matching patterns used elsewhere in the app.
- **Suggested command:** `/impeccable harden`

### [P2] Money formatting inconsistent with Dashboard
- **Why it matters:** DESIGN.md mandates `tabular-nums` on all money. Dashboard uses `formatMoney` + user currency; Analytics hardcodes `฿` and skips tabular nums on hero stats — digits won't align and multi-currency users see wrong symbol.
- **Fix:** Adopt `formatMoney` + `useUserSettings` currency; add `tabular-nums` to all amount displays.
- **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Alex (Power User):** Clicks Download expecting CSV — nothing happens. Can't jump from "Food 32%" to filtered transactions. No MoM delta on summary cards (Dashboard has "vs last month"). Will use Dashboard instead and ignore Analytics.

**Sam (Accessibility):** Download is `size="icon"` with no accessible name. Charts (Recharts) lack textual summaries for screen readers. Savings rate conveyed by Progress bar + number — color/bar alone may not announce context. Focus order through seven cards is long with no skip links.

**Maya (Thai daily logger — project persona):** Sees English-only labels ("Financial Habits Summary", "Weekday Spending Pattern") while MonthPicker uses Thai month abbreviations — bilingual inconsistency. Hardcoded ฿ assumes THB even if she tracks mixed currency.

## Minor Observations

- `TrendingUp` / `TrendingDown` imported but unused.
- `Legend` imported from recharts but unused.
- `weekdayPattern` includes `average: 0` always — dead series / misleading if a second bar were added.
- Financial Habits nests four `bg-muted` tiles inside a Card — reads like nested cards (DESIGN.md says don't nest cards).
- Loading uses pulse icon + text; DESIGN.md prefers skeleton loaders for content areas.
- Empty state lacks primary CTA button (Dashboard links to actions more readily).

## Questions to Consider

- What if Analytics showed **one insight headline** at the top ("You spent 18% more on Food than last month") instead of four stat cards?
- Does this page need to exist separately from Dashboard, or should it be a **deeper drill-down** from Dashboard charts?
- What would a confident version look like with **half the cards** and working export?
