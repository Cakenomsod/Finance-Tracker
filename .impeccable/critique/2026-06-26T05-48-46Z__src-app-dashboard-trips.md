---
target: trips
total_score: 25
p0_count: 0
p1_count: 3
p2_count: 3
p3_count: 0
timestamp: 2026-06-26T05-48-46Z
slug: src-app-dashboard-trips
---
## Anti-Patterns Verdict

**LLM assessment:** Trips does not scream "generic AI landing page," but it does hit several patterns your own DESIGN.md explicitly bans: identical icon + label + big-number stat grids on both the list and detail pages, card-stuffed layouts with nested bordered rows inside cards, and emoji sprinkled through data labels (split modes, settlement empty state). The shadcn vocabulary is cohesive with the rest of the app, which helps trust — but a user fluent in Splitwise or Tricount would pause at how much each trip card tries to do at once, and at raw Firebase UIDs appearing as payer names. The "Trusted Ledger" north star (numbers first, mint accent scarce, clarity before ceremony) is partially there on the detail expense table, but lost on the list view and summary strips.

**Deterministic scan:** `detect.mjs` on `src/app/(dashboard)/trips` and `src/components/trips` returned **0 findings** (clean exit). No gradient text, side-stripe borders, or tracked uppercase eyebrows flagged.

**Visual overlays:** Browser navigation to `http://localhost:3000/trips` redirected to `/login?from=%2Ftrips` (auth required). Live detector injection was not run on the authenticated surface. No user-visible overlay is available for this session.

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Centered pulsing-plane loading states instead of skeletons; async save feedback not surfaced on list actions |
| 2 | Match System / Real World | 2 | "Trip / Event Mode" vs sidebar "Trip Mode"; payer shows UID keys; emoji split labels in a finance ledger |
| 3 | User Control and Freedom | 3 | Cancel/back on dialogs; close/reopen/delete confirmations; card click vs nested actions need care |
| 4 | Consistency and Standards | 3 | shadcn patterns match app; naming and language mix (EN/TH) diverge within trips |
| 5 | Error Prevention | 3 | Destructive confirms; trip close guardrails; legacy edit blocked but via `alert()` |
| 6 | Recognition Rather Than Recall | 2 | Hover-only row actions; whole-card navigation not signposted; settlements math hidden in tabs |
| 7 | Flexibility and Efficiency | 3 | AI receipt capture, search, payer filter chips — no keyboard accelerators |
| 8 | Aesthetic and Minimalist Design | 2 | List trip cards and detail 4-up stat row are visually noisy; nested mini-cards inside cards |
| 9 | Error Recovery | 2 | `alert()` for legacy edit; delete copy admits orphaned data — honest but alarming |
| 10 | Help and Documentation | 2 | Active empty state teaches; completed tab and settlements jargon assume prior knowledge |
| **Total** | | **25/40** | **Acceptable — significant improvements needed** |

**Cognitive load checklist:** 4+ failures — trip cards fail single-focus, chunking, and minimal-choices (settlements + expenses + participants + balance in one card); detail expense filters can exceed 4 visible payer chips with larger groups; working-memory bridge between list card settlements and detail Settle tab.

---

## Overall Impression

Trips is functionally rich — multi-currency, AI capture, itemized debts, settlement recording — but the UI treats every trip like a mini-dashboard before you open it. The biggest opportunity is **distillation**: make the list scannable (name, dates, your balance, one CTA), push depth to the detail page, and align copy/language with the cooperative Thai+English voice in PRODUCT.md.

---

## What's Working

1. **Detail page tab structure** — Expenses / Analytics / Settle separates concerns once you're inside a trip; expense list uses the same date-grouping pattern as Transactions, which rewards learning.
2. **Settlement plan + Record payment** — The greedy min-transfer list with a direct "Record" action matches real-world "who pays whom" mental models; Thai balance copy on the per-person summary ("ได้รับคืน" / "ต้องจ่ายคืน") fits the audience.
3. **AI capture inline on detail** — `TripAiPanel` on the detail page (not modal-first) aligns with DESIGN.md's signature AI quick-capture pattern and supports speed-to-capture for receipt-heavy trips.

---

## Priority Issues

### [P1] Trip list cards are overloaded cognitive units
- **Why it matters:** Each `TripCard` surfaces total spend, your balance, avatar stack, settlement rows, up to five expense rows, and Add Expense — before navigation. Users scanning multiple trips cannot answer "which trip needs my attention?" in under two seconds.
- **Fix:** Collapse list cards to title, status, dates, **your net balance**, participant count, and one primary action ("Open" or "Add expense"). Move settlements and recent expenses exclusively to detail.
- **Suggested command:** `/impeccable distill trips`

### [P1] Hero-metric stat grids violate your design system
- **Why it matters:** Both pages use the banned pattern (icon + muted label + `text-3xl font-bold` number) in a 3- or 4-column grid — exactly what DESIGN.md calls out as generic SaaS dashboard scaffolding. It competes with the actual trip content for attention.
- **Fix:** Remove the list-page aggregate stats or replace with a single inline sentence ("3 active trips · ฿142,500 total"); on detail, keep at most **one** highlighted figure (total in trip currency) and demote the rest to the Analytics tab.
- **Suggested command:** `/impeccable quieter trips`

### [P1] Payer names show raw member keys on list cards
- **Why it matters:** Recent expense rows render `Paid by {tx.paidBy || 'Me'}` without `getDisplayName`, so Firebase UIDs can appear in the UI — alienating and breaks "social without friction."
- **Fix:** Use `trip.memberProfiles` / `getDisplayName` consistently everywhere payer is shown (list card, legacy rows).
- **Suggested command:** `/impeccable clarify trips`

### [P2] Desktop expense actions are hover-gated
- **Why it matters:** `opacity-0 group-hover:opacity-100` on the expense table kebab hides Edit/Delete from keyboard users, touch users, and anyone who doesn't discover hover — fails recognition and accessibility.
- **Fix:** Always visible actions, or a single overflow menu column with persistent focusable trigger; ensure 44px touch targets on mobile (mobile layout already shows actions — align desktop).
- **Suggested command:** `/impeccable audit trips`

### [P2] Bilingual and naming inconsistency
- **Why it matters:** Page title "Trip / Event Mode" ≠ nav "Trip Mode"; create dialog is English except "สมาชิก"; detail empty states are Thai; settlement plan is English — violates "bilingual by default" as bolted-on, not natural.
- **Fix:** Pick a primary label ("Trips" or "ทริป"), use paired EN/TH only where the rest of the app does, and audit all trips strings in one pass.
- **Suggested command:** `/impeccable clarify trips`

### [P2] Loading states use centered spinners, not skeletons
- **Why it matters:** DESIGN.md requires skeleton loaders for content areas. The plane pulse + "Loading trips..." leaves layout shift when cards appear.
- **Fix:** Skeleton trip card grid and detail header/summary placeholders matching final layout.
- **Suggested command:** `/impeccable polish trips`

---

## Persona Red Flags

**Alex (Power User):** No keyboard path to create trip or add expense; must open modals from list; expense table actions require hover; cannot batch-settle from list view; legacy rows blocked with blocking `alert()` instead of inline toast + action.

**Jordan (First-Timer):** "Trip / Event Mode" doesn't match sidebar "Trip Mode"; doesn't know whole card is clickable vs "Add Expense" button; "Legacy" badge on expenses unexplained; Settle tab vs inline "Settlements Needed" on card duplicates concepts; no help on what "Close Trip" does until confirm dialog.

**Sam (Accessibility):** MoreHorizontal icon buttons lack visible text labels in markup review; debt status relies on green/red text classes; hover-only actions on desktop table; filter chips are native `<button>` but member list can overflow horizontal scan order.

**Kai (Thai group traveler — project persona):** Mixed EN/TH breaks cooperative tone mid-flow; ฿ and home-currency hints are good; settlement copy in Thai on analytics but English on list — feels like two products stitched together.

---

## Minor Observations

- Analytics "Paid vs Share" chart plots `paid` and `net`, not share — tooltip/description mismatch confuses the chart's purpose.
- Celebration emoji in settled empty state ("🎉") edges toward playful-fintech anti-reference.
- Duplicate `// --- Trip Card Component ---` comment suggests the card grew organically and could be split.
- `Calculator` imported on list page appears unused (noise in maintenance).
- List page `TripCard` uses `calculateSettlements(participants)` where participants use mixed share math — settlements on card may disagree with detail Settle tab (trust risk for money UI).

---

## Questions to Consider

- What if the trips list were a **dense table** (name, dates, your balance, status) instead of mini-dashboard cards?
- Does the list page need aggregate stats at all, or only the detail view?
- Could "Settlements Needed" on the list card be a single badge ("2 transfers pending") linking to the Settle tab?
