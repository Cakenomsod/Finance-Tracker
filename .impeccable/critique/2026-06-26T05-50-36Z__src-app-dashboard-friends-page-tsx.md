---
target: friends
total_score: 24
p0_count: 0
p1_count: 3
timestamp: 2026-06-26T05-50-36Z
slug: src-app-dashboard-friends-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Text-only "กำลังโหลด..." instead of skeletons; accept/decline/remove have no in-flight feedback |
| 2 | Match System / Real World | 3 | Thai copy is natural; English "Friends" title clashes with Thai body |
| 3 | User Control and Freedom | 2 | Cancel/decline/delete lack confirmation; no undo on reorder; can't remove registered friends |
| 4 | Consistency and Standards | 3 | Matches shadcn vocabulary; simpler/less polished than Debts page |
| 5 | Error Prevention | 2 | No confirm on destructive actions; no email format validation before search |
| 6 | Recognition Rather Than Recall | 2 | Sent tab hides recipient (?? avatar); drag hint references ⋮⋮ but shows grip icon |
| 7 | Flexibility and Efficiency | 3 | Alias editing + drag reorder are good; Enter submits forms |
| 8 | Aesthetic and Minimalist Design | 2 | Two add cards always dominate; nested card inside tabs |
| 9 | Error Recovery | 3 | Inline Thai error/success messages are clear and localized |
| 10 | Help and Documentation | 2 | Account vs custom contact distinction needs stronger first-run guidance |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment**: Not overt AI slop. The page reads as restrained shadcn product UI — cool dark surfaces, Cooperative Mint on primary actions, no gradient text or cream backgrounds. Mild tells: the symmetric two-card add grid always pinned above content (generic dashboard pattern), and bilingual split ("Friends" heading + Thai everywhere else). Overall it feels familiar and trustworthy for a finance tool, not decorative-AI.

**Deterministic scan**: Clean. `detect.mjs` returned 0 findings across `page.tsx` and `src/components/friends/`.

**Visual overlays**: Browser visualization was attempted (navigated to `http://localhost:3000/friends`, captured snapshot + screenshot). Live-server started on port 8400 for `detect.js` injection, but the browser tab became unavailable before script injection could complete — no reliable user-visible overlay. Visual review used snapshot + screenshot fallback.

## Overall Impression

The Friends page is functionally sound and on-brand: cooperative tone, clear Thai copy, sensible tab structure for requests vs contacts. The biggest gap is information architecture — the page optimizes for "first friend ever" at the expense of daily use. Two large add cards permanently occupy prime viewport while the contact list (the reason users return) sits below the fold. Secondary gaps: sent-request rows don't identify the recipient, and loading/empty states don't meet the design system's own skeleton/empty-state bar.

## What's Working

1. **Dual contact model is well explained** — "เพิ่มเพื่อน (มีบัญชี)" vs "เพิ่มรายชื่อเอง" card descriptions make the account/custom distinction legible without a tutorial.
2. **Pending-request attention design** — destructive red badge on "คำขอที่รอ" tab (and mobile nav) correctly signals actionable inbound requests without gamification.
3. **Alias + reorder power features** — inline nickname editing with comma-separated input and drag-to-sort contacts show real product thinking for Thai social-money workflows (nicknames matter for AI parsing and trip splits).

## Priority Issues

### [P1] Sent requests hide who you invited
- **Why it matters**: Users can't tell which pending outbound request is which; "??" avatar and "รอการยืนยัน..." force recall instead of recognition.
- **Fix**: Fetch/display `toDisplayName` or email from the request; show initials avatar from recipient name.
- **Suggested command**: `/impeccable clarify`

### [P1] Add forms dominate returning-user experience
- **Why it matters**: Users with contacts revisit to manage/reorder/accept requests — two full cards always above the list add extraneous cognitive load and push the list down.
- **Fix**: Collapse add actions into a single primary "เพิ่มรายชื่อ" button that expands inline or opens a compact sheet; show full cards only on empty state.
- **Suggested command**: `/impeccable distill`

### [P1] Loading state violates design system
- **Why it matters**: DESIGN.md specifies skeleton loaders for content areas; centered "กำลังโหลด..." text feels unfinished and causes layout shift when data arrives.
- **Fix**: Replace with 3–5 skeleton list rows matching `SortableFriendList` item height.
- **Suggested command**: `/impeccable polish`

### [P2] Destructive actions lack guardrails
- **Why it matters**: One tap deletes custom contacts, cancels sent requests, or declines inbound requests — high regret risk in a social-money context.
- **Fix**: Add lightweight confirm dialog (or undo toast) for delete/cancel/decline.
- **Suggested command**: `/impeccable harden`

### [P2] Drag reorder is mouse-only
- **Why it matters**: HTML5 `draggable` on list rows with a decorative grip button — no keyboard path, poor screen-reader support.
- **Fix**: Add "move up/down" buttons or proper dnd-kit with keyboard sensors; ensure grip has `aria-grabbed` state.
- **Suggested command**: `/impeccable audit`

## Persona Red Flags

**Alex (Power User)**: Two add cards waste vertical space on every visit. No bulk alias edit. Reorder requires mouse drag — no keyboard accelerators. Accept/decline buttons give no loading feedback on slow connections.

**Jordan (First-Timer)**: English "Friends" title while everything else is Thai creates uncertainty about language mode. After sending a request, must switch to "ส่งแล้ว" tab to verify — no inline confirmation in the add card beyond ephemeral success text. Unclear whether custom contacts can later be linked to real accounts.

**Sam (Accessibility)**: Trash delete on custom contacts is icon-only with no `aria-label`. Drag handle label exists but dragging is on the parent row, not the handle — confusing for assistive tech. Pending request Accept/Decline may overflow horizontally on narrow viewports, clipping touch targets.

## Minor Observations

- Drag hint text says "ลากไอคอน ⋮⋮" but UI shows `GripVertical` (six dots vertical, not ⋮⋮).
- Friends tab gets a count badge; Sent tab doesn't — asymmetric wayfinding.
- Empty states: friends tab has icon + guidance; pending/sent tabs are plain centered text.
- Success messages use `text-primary` (mint) — acceptable but indistinguishable from links at a glance; consider semantic success styling.
- Registered friends show badge but can't be removed from this page — may confuse users expecting full contact management.

## Questions to Consider

- What if add-contact were a single entry point that branches (email vs name) only when tapped?
- Should the contact list be the page hero, with add/request actions in the header?
- What would a confident, returning-user version look like with add forms hidden behind one button?
