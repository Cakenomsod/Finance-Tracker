---
target: Debts & Shared
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-06-26T05-50-11Z
slug: src-app-dashboard-debts
---
## Anti-Patterns Verdict

**LLM assessment**: Not overtly "AI slop" in the neon-gradient sense — it uses your shadcn vocabulary and semantic red/mint correctly. But it drifts toward the **hero-metric template** the design system explicitly rejects: three large stat cards with `text-3xl font-bold` numbers and gradient-tinted backgrounds at the top. The page also suffers from **bilingual schizophrenia** (English headers and tabs beside Thai table copy and dialogs) and **accounting jargon** (`เจ้าหนี้` / `ลูกหนี้`) that undermines the cooperative, friend-first tone in PRODUCT.md.

**Deterministic scan**: `detect.mjs` on `src/app/(dashboard)/debts/page.tsx` returned **0 findings** (clean exit).

**Visual overlays**: Browser automation was unavailable (navigation error; no open tabs). Live-server started on port 8400 but injection could not run. **No reliable user-visible overlay is available** for this run — assessment relied on source review and cross-page comparison.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Plain "Loading debts..." text instead of skeleton loaders used on Transactions |
| 2 | Match System / Real World | 2 | Mixed EN/TH at same hierarchy; creditor/debtor accounting terms feel corporate |
| 3 | User Control and Freedom | 3 | Settle dialog has cancel, partial-pay presets, and amount cap |
| 4 | Consistency and Standards | 2 | Language split, loading pattern, payment-history colors differ mobile vs desktop |
| 5 | Error Prevention | 3 | Settle amount validated; max bound on input; toast on invalid amounts |
| 6 | Recognition Rather Than Recall | 2 | Clickable debt rows lack affordance; add-debt uses free-text name not contacts |
| 7 | Flexibility and Efficiency | 2 | Partial settle shortcuts help; no bulk actions or keyboard path |
| 8 | Aesthetic and Minimalist Design | 2 | Duplicated dashboard summary + full dashed card for one button |
| 9 | Error Recovery | 3 | Thai toast messages with specific validation feedback |
| 10 | Help and Documentation | 1 | Empty states are one muted line with no next-step guidance |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

**Cognitive load**: 3 checklist failures (visual hierarchy, single focus, minimal choices). Summary cards, add-debt card, and three tabbed lists compete for attention before the user reaches the actual debt rows.

**Emotional journey**: Settle flow is reassuring (context, partial pay, auto-transaction note). Valley at page load — large red "You Owe" number can feel accusatory before cooperative copy appears. Empty states miss the chance to reduce awkwardness around money between friends.

## Overall Impression

The debts page has solid bones: date-grouped lists, partial settlement, trip/transaction source badges, and a thoughtful settle dialog. But it reads like two products stitched together — an English SaaS summary header on top of a Thai social ledger below — and repeats information the dashboard already shows. The single biggest opportunity is to **align language and tone with "social without friction"** and **collapse redundant chrome** so users land on people and amounts, not three hero metrics.

## What's Working

1. **Settle dialog** — Shows counterparty, description, remaining balance, full/half shortcuts, and explains auto-created expense transaction. Reduces anxiety at the highest-stakes moment.
2. **Date grouping** — Reuses `DateGroupDividerRow` and `groupItemsByDate` from Transactions; scannable chronology without extra mental mapping.
3. **Source provenance** — Badges for ทริป / ธุรกรรม / บันทึกเอง and disabled delete on auto-generated debts set correct expectations.

## Priority Issues

### [P1] Bilingual split at the same visual level
- **Why it matters**: Header ("Debts & Shared Expenses"), summary labels ("You Owe", "Owed to You"), and two tab triggers are English while table headers, empty states, settle UI, and the third tab are Thai. Thai-primary users see foreign chrome; English-primary users hit Thai mid-task. Violates DESIGN.md principle 4.
- **Fix**: Pick one primary language per surface layer (or mirror consistently: EN title + EN tabs + EN empty states, with Thai only where the rest of the app already uses it). Sidebar says "Debts & Shared" — page title should match.
- **Suggested command**: `/impeccable clarify`

### [P1] Accounting jargon (`เจ้าหนี้` / `ลูกหนี้`) vs cooperative tone
- **Why it matters**: PRODUCT.md calls for shared money to feel cooperative, not confrontational. Creditor/debtor labels read like a bank ledger, not "who you split dinner with."
- **Fix**: Replace with person-centric copy already used elsewhere: "จ่ายให้ [name]" / "รับจาก [name]" (as in payment history and settle dialog). Drop the accounting column label on mobile secondary line.
- **Suggested command**: `/impeccable clarify`

### [P1] Empty states don't teach the next action
- **Why it matters**: "คุณยังไม่ติดใคร" and "ยังไม่มีประวัติการจ่ายคืน" end the journey. DESIGN.md requires empty states that teach ("Add your first…"), especially for socially awkward flows.
- **Fix**: Add a primary CTA (Record debt / Split an expense / View trips) and one line of context for how debts get created automatically from transactions and trips.
- **Suggested command**: `/impeccable onboard`

### [P2] Hero-metric summary row duplicates the dashboard
- **Why it matters**: Three `text-3xl` stat cards with gradient tints mirror the dashboard Debt Summary card. Users who navigated here already want the list, not a second billboard. Approaches the banned hero-metric pattern.
- **Fix**: Replace with a compact inline summary (single row: owe | owed | net) or drop totals when non-zero debts exist and let the tab badges carry counts. Remove gradient card backgrounds; use border + semantic color on the number only.
- **Suggested command**: `/impeccable distill`

### [P2] Loading state breaks design system
- **Why it matters**: `Loading debts...` is English plain text. Transactions uses `TransactionTableSkeleton`. Inconsistent and gives no layout stability.
- **Fix**: Extract a `DebtTableSkeleton` matching mobile cards + desktop table structure.
- **Suggested command**: `/impeccable polish`

## Persona Red Flags

**Jordan (First-Timer)**: Lands on English "You Owe" / "Owed to You" then sees Thai `เจ้าหนี้` in rows — can't tell if these mean the same thing. "Record New Debt" dialog says "manual loan" (corporate). Empty state "คุณยังไม่ติดใคร" offers no button. Will not discover that trip expenses auto-create debts.

**Alex (Power User)**: Must open a modal per settlement; no multi-select or "settle all with [person]." Summary cards push the actionable table below the fold on laptop. Scans duplicate dashboard numbers before reaching data.

**Sam (Accessibility)**: `MoreHorizontal` icon-only menu buttons have no `aria-label`. Loading state is unannounced text, not a live region. Payment history uses color alone (primary vs muted mobile; success vs destructive desktop) without consistent non-color cue.

## Minor Observations

- Full-width dashed `Card` wrapping a single "Record New Debt" button wastes ~80px vertical space — a header action button would match Transactions patterns.
- Clickable debt rows (`cursor-pointer` when linked to transaction) have no chevron, underline, or "ดูรายการ" hint.
- Payment history: mobile shows received as `text-primary`, desktop table uses `text-success` — semantic drift.
- Add-debt "Person Name" is free text stored as `userId`; no contact/friend picker unlike AI expense flows.
- `tabular-nums` is correctly applied on amounts — keep this.

## Questions to Consider

- What if the page opened directly on the debt list with counts in tabs, and totals lived only on the dashboard?
- Does "Debts & Shared" need a third concept explained (shared expenses vs debts), or is the name doing unused work?
- What would a confident Thai-first version sound like if every label assumed you're settling up with a friend, not a creditor?
