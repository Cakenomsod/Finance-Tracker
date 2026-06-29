---
target: dashboard
total_score: 26
p0_count: 0
p1_count: 2
timestamp: 2026-06-26T05-53-09Z
slug: src-app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Month transitions and recurring-action toasts are solid; initial load uses a centered spinner instead of skeleton placeholders per DESIGN.md |
| 2 | Match System / Real World | 3 | ฿ formatting and debt semantics land well; main copy is English-only while recurring card is i18n'd |
| 3 | User Control and Freedom | 3 | Month picker and drill-down links work; recurring "Confirm paid" has no undo |
| 4 | Consistency and Standards | 2 | Insights and recurring cards use gradient fills that break the restrained Morning Balance system |
| 5 | Error Prevention | 2 | Recurring confirm is one-click with no guard; recent-transaction rows are click-only |
| 6 | Recognition Rather Than Recall | 3 | Stat labels and debt blocks are clear; Income vs Expenses "more" control is icon-only |
| 7 | Flexibility and Efficiency | 2 | No keyboard path for transaction rows or month stepping; power users rely on sidebar Quick Add |
| 8 | Aesthetic and Minimalist Design | 2 | Seven card regions compete at once — classic dashboard density without a single focal point |
| 9 | Error Recovery | 3 | Toast errors on recurring actions; empty chart states are text-only with no recovery CTA |
| 10 | Help and Documentation | 2 | No contextual help; Insights panel is the only guidance surface |
| **Total** | | **26/40** | **Acceptable** |

## Anti-Patterns Verdict

**LLM assessment:** Not screaming "AI slop," but several tells remain. The four identical stat cards (icon well + label + big number + delta badge) echo the banned hero-metric grid. The Insights card (`border-primary/20 bg-gradient-to-br from-card to-primary/5`) and RecurringDueCard (`bg-gradient-to-r from-amber-500/5`) add decorative gradients the design system explicitly forbids. Cool Morning Balance neutrals and Cooperative Mint restraint elsewhere keep it from feeling fully generic — this reads as a competent shadcn dashboard that hasn't been distilled yet.

**Deterministic scan:** Clean — `detect.mjs` returned zero findings across `src/app/(dashboard)/page.tsx` and `src/components/dashboard`.

**Visual overlays:** Not available. Browser navigation redirected to `/login` (auth gate); live-server injection was not attempted on the login shell.

## Overall Impression

The dashboard is functionally rich and on-brand in its cool neutrals, tabular money, and semantic red/mint debt blocks. The biggest gap is editorial: too many equally-weighted cards, no obvious "do this next" on the page itself, and decorative gradients on two cards that undermine the "Trusted Ledger" north star. It works for returning users who know the app; first-timers and power users both hit friction.

## What's Working

1. **Month-scoped data choreography** — `MonthPicker`, `MonthAnimatedValue`, and `MonthContentTransition` give clear feedback when changing periods. Numbers feel alive without page reloads.
2. **Semantic money presentation** — `tabular-nums`, `formatMoney`, inverted expense-change coloring (up expenses = bad), and debt red/mint blocks follow DESIGN.md's Semantic Lock Rule.
3. **Recurring due card** — Actionable, bilingual, dismissible (snooze/skip/confirm). Exactly the kind of task-first surface this product needs.

## Priority Issues

### [P1] Full-page spinner blocks the entire dashboard on load
- **Why it matters:** Users stare at a blank spinner while debts, trips, and chart data resolve at different speeds. DESIGN.md mandates skeleton loaders for content areas.
- **Fix:** Replace the centered `Loader2` block with skeleton stat cards, chart placeholders, and list stubs that resolve independently.
- **Suggested command:** `/impeccable polish dashboard`

### [P1] No clear primary action on the dashboard surface
- **Why it matters:** Seven card regions compete for attention. Quick Add lives in the sidebar/header, not on the page — Jordan won't know where to start; Alex must hunt.
- **Fix:** Either demote secondary cards below the fold on mobile, or add a compact inline quick-capture strip under the header (AI input or "Add transaction" primary).
- **Suggested command:** `/impeccable distill dashboard`

### [P2] Decorative gradients on Insights and Recurring cards
- **Why it matters:** Violates the One Voice Rule and PRODUCT.md anti-reference against playful-fintech decoration. Makes two cards feel "special" without informational reason.
- **Fix:** Use border + `shadow-sm` + semantic tint only (amber border for due, no gradient fill; Insights uses standard card surface).
- **Suggested command:** `/impeccable quieter dashboard`

### [P2] Identical four-stat card grid reads as template dashboard
- **Why it matters:** Same structure × 4 (icon well, muted label, bold value, delta badge) is the exact SaaS dashboard cliché DESIGN.md bans.
- **Fix:** Lead with one hero metric (net cash flow), show the other three as a compact inline row or sparkline strip; drop redundant icon wells.
- **Suggested command:** `/impeccable layout dashboard`

### [P2] Recent transactions are mouse-only
- **Why it matters:** `onClick` on a `div` with no `tabIndex`, `role="button"`, or keyboard handler — Sam can't reach them; Alex can't arrow through.
- **Fix:** Use `button` or `Link` semantics, visible focus ring, Enter/Space activation.
- **Suggested command:** `/impeccable audit dashboard`

## Persona Red Flags

**Alex (Power User):** Cannot keyboard-navigate recent transactions or step months with arrow keys. Must open MonthPicker for every period change. No inline quick-add on dashboard — detour to sidebar FAB or header.

**Sam (Accessibility):** Recent transaction rows are `div` + `onClick` — invisible to keyboard and screen readers. Week-comparison badge relies on color (primary vs destructive) without a text label beyond the percentage. Icon-only `MoreHorizontal` link to Analytics has no accessible name beyond the icon.

**Nui (Thai daily logger — project persona):** Recurring card is Thai-capable via `t()`, but the dashboard header, stat labels, empty states, and insights prefixes are English-only. Mixed language on one screen increases translation effort for the primary audience.

## Minor Observations

- Empty states ("No transaction data yet", "No expenses this month") lack action buttons — DESIGN.md says teach the next step with a CTA.
- `Income vs Expenses` chart hint "เลื่อนซ้ายเพื่อดูข้อมูลเก่ากว่า" is Thai while surrounding chrome is English — good for Thai users, inconsistent otherwise.
- `Plus` icon is imported in `page.tsx` but unused.
- Debt Summary and Insights both link out ("View All") — good, but Insights gradient makes it feel like an ad slot.

## Questions to Consider

- What if net cash flow were the only large number above the fold, with income/expenses/savings as secondary context?
- Does the dashboard need three charts on first visit, or would one trend + category breakdown suffice until the user scrolls?
- What would a confident, gradient-free version of the Insights panel look like — still distinct without `primary/5` wash?
