---
target: settings
total_score: 23
p0_count: 0
p1_count: 4
p2_count: 2
timestamp: 2026-06-26T05-50-46Z
slug: src-app-dashboard-settings-page-tsx
---
## Anti-Patterns Verdict

**LLM assessment:** Settings does not read as generic AI landing-page slop — it uses your established shadcn + Morning Balance card vocabulary consistently. The failure mode is different: a **prototype tail** stitched onto production-quality sections. Profile, Categories, and Recurring Expenses feel like a real Finance Tracker surface (i18n, Firestore, confirmations, empty states). The bottom half of the page (Notifications, AI Preferences, LINE Integration, Appearance extras, Data & Privacy) reads as scaffolded demo UI: hardcoded English, local-only state, fake connection status, and buttons that do nothing. A user fluent in Notion or Linear settings would trust the top of the page and lose trust scrolling down.

**Deterministic scan:** `detect.mjs` on `src/app/(dashboard)/settings/page.tsx` and `src/components/settings` returned **0 findings** (clean exit). No gradient text, side-stripe borders, tracked uppercase eyebrows, or identical icon-card grids flagged.

**Visual overlays:** Browser navigation to `http://localhost:3000/settings` redirected to `/login?from=%2Fsettings` (auth required). Live detector injection was not run on the authenticated surface. **No user-visible overlay is available for this session.**

---

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Profile returns `null` while loading (blank flash); categories/recurring use spinners not skeletons; notification toggles give no persistence feedback |
| 2 | Match System / Real World | 2 | Hardcoded "LINE Bot Connected" and webhook URL; developer-facing webhook in user settings; EN/TH mix on one page |
| 3 | User Control and Freedom | 2 | Fake notification toggles reset on refresh; no undo for currency/language (acceptable) but placeholder controls imply capabilities that don't exist |
| 4 | Consistency and Standards | 2 | Header/profile/categories use `t()`; lower sections hardcoded English; Add button primary in Categories, outline in Recurring; LINE duplicated from `/line` |
| 5 | Error Prevention | 2 | Delete Account styled destructive with no confirmation dialog; Compact Mode switch is inert |
| 6 | Recognition Rather Than Recall | 2 | Webhook copy button uses `ChevronRight` not Copy; recurring form labels `categoryName` for expense name; delete dialog reuses category strings |
| 7 | Flexibility and Efficiency | 2 | No section nav or anchor links on a long 8-card scroll; no keyboard accelerators |
| 8 | Aesthetic and Minimalist Design | 2 | Eight same-weight cards with no IA grouping; LINE status banner uses `bg-primary/10` (mint wash) for decorative status |
| 9 | Error Recovery | 3 | Real sections toast errors clearly; profile/category save preserves form state |
| 10 | Help and Documentation | 2 | AI section is test-only with no setup guidance; budget field shows "No budget set" as helper text (wrong message) |
| **Total** | | **23/40** | **Acceptable — significant improvements needed** |

**Cognitive load checklist:** 4 failures — page-level single focus (8 competing sections), no progressive disclosure, working-memory cost of scrolling to find Appearance/Data, and duplicate LINE integration vs dedicated nav item. Within-card chunking is mostly fine (≤4 notification toggles, theme trio).

---

## Overall Impression

Settings is a **split personality**: the top three cards are shippable product UI; the rest is a settings-page template waiting to be wired or removed. The single biggest opportunity is **distillation + honesty** — either implement or hide placeholder sections, unify i18n, and add lightweight section navigation so users aren't scrolling through a card catalog.

---

## What's Working

1. **Profile block** — Avatar + inline currency/language selects with live `formatMoney` preview and immediate save + toast feedback matches "clarity before ceremony" and bilingual-by-default principles.
2. **Categories management** — Live preview in the dialog, color swatches with focus rings, delete `AlertDialog`, dashed empty state with CTA, and `aria-label` on icon actions — this is the standard other sections should match.
3. **Theme picker** — Three explicit options (Dark / Light / Sync) with border highlight on active choice and `disabled` until mounted avoids hydration flash; appropriate for product settings.

---

## Priority Issues

### [P1] Placeholder sections undermine trust
- **Why it matters:** Notifications toggles are `useState` only (reset on refresh). LINE shows "Connected" with a hardcoded webhook. Export, Delete, Disconnect, and Compact Mode have no handlers. Users cannot tell what's real — violates Visibility and Error Prevention heuristics and PRODUCT.md "clarity before ceremony."
- **Fix:** Wire to Firestore/API or remove/hide sections until ready. Replace fake LINE status with real connection state from the same source as `/line`. Add "Coming soon" only if you must show roadmap — never fake enabled switches.
- **Suggested command:** `/impeccable harden settings`

### [P1] Severe i18n split on one page
- **Why it matters:** Title/subtitle and the three child components respect locale; Notifications, LINE, Appearance, Data & Privacy, and parts of AI are hardcoded English while AI buttons are Thai. Thai users see a bilingual patchwork; violates "bilingual by default."
- **Fix:** Move all `settings.page.*` strings into `src/lib/i18n.ts` (EN + TH) and use `t()` everywhere, including card titles, descriptions, and toast messages in `page.tsx`.
- **Suggested command:** `/impeccable clarify settings`

### [P1] No information architecture for a long settings surface
- **Why it matters:** Eight full-width cards in one column force excessive scrolling on mobile and desktop. LINE already has its own nav item (`/line`) — duplicating it here adds extraneous load without new capability.
- **Fix:** Group into tabs or a side sub-nav (Account · Categories · Integrations · Appearance · Data). Move LINE detail to `/line` only; link from settings instead of duplicating. Consider pulling Categories/Recurring to top-level nav if they're daily-use.
- **Suggested command:** `/impeccable shape settings`

### [P1] AI Preferences is a dead-end panel
- **Why it matters:** `useUserSettings` exposes `saveImmichSettings`, `saveAiSettings`, `aiTextProvider`, `localAiBaseUrl` — but the UI only offers "ทดสอบ Immich" / "ทดสอบ Local AI" with no configuration fields. Power users cannot set up the integrations the tests assume.
- **Fix:** Add Immich base URL + API key fields (or link to env docs), AI provider select, and persist via existing hooks; show last-verified timestamp after test success.
- **Suggested command:** `/impeccable craft settings AI integration panel`

### [P2] Recurring expenses polish gaps
- **Why it matters:** Edit/delete icon buttons lack `aria-label` (categories have them). Delete `AlertDialog` reuses `settings.deleteCategory` title/action. Name field label uses `settings.categoryName`. Empty state is plain text vs categories' illustrated empty state.
- **Fix:** Add recurring-specific i18n keys; align empty state pattern with categories; add aria labels.
- **Suggested command:** `/impeccable polish settings recurring`

### [P2] Profile loading flash
- **Why it matters:** `if (loading && !profile) return null` removes the entire profile card during fetch — layout shift and blank gap at the top of settings.
- **Fix:** Render card skeleton (avatar circle + two text bars + select placeholders) per DESIGN.md skeleton guidance.
- **Suggested command:** `/impeccable polish settings profile`

---

## Persona Red Flags

**Alex (Power User):** Scrolls past Categories/Recurring to find AI config — finds only test buttons. Toggles five notifications, refreshes, all reset. Cannot copy webhook URL (chevron button, no handler). Abandons integrations section as noise.

**Jordan (First-Timer):** Sees "LINE Bot Connected" and assumes messaging works; may never visit `/line` for real setup. "Webhook URL" and `api.corefinance.app` are intimidating with no explanation. Mixed Thai/English on AI buttons vs English section titles increases translation effort.

**Sam (Accessibility):** Recurring expense row edit/delete buttons are icon-only without `aria-label` — screen reader hears unlabeled buttons. Color swatches use hex strings as `aria-label`. Profile section disappears entirely during load (no live region or skeleton announcement).

---

## Minor Observations

- Categories and Recurring both use the `CreditCard` icon — visual duplication in the same scroll.
- `bg-primary/10` on LINE connected banner spends Cooperative Mint on a status strip (One Voice Rule).
- Theme section's Compact Mode switch has no `checked` state or handler.
- Notification section has five toggles but no grouping (e.g., Alerts vs Reports).
- Recurring delete `AlertDialogAction` lacks destructive styling/loading state that categories delete has.

---

## Questions to Consider

- Should Categories and Recurring live under Settings at all, or deserve their own nav entries given how often Thai users budget by category?
- If LINE and AI are integration surfaces, would a single "Integrations" hub replace three scattered cards?
- What would a "confident v1" settings page contain if you shipped only what's wired today?
