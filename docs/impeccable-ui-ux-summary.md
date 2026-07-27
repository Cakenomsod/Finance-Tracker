# Impeccable UI/UX Polish — Summary

**Date:** 2026-07-27  
**Command:** Impeccable `polish` (product register · Trusted Ledger)  
**Quality bar:** Flagship alignment to `PRODUCT.md` / `DESIGN.md`  
**Scope:** 10 app surfaces, multitask per page  

Per-page write-ups: [`docs/impeccable-polish/`](./impeccable-polish/)

---

## Verdict

All ten pages were polished against the same north star: **clarity before ceremony**, restrained Cooperative Mint (≤10%), cool Morning Balance neutrals, tabular money, teaching empty states, skeletons instead of blank spinners, and 150–250ms motion with `prefers-reduced-motion`.

Business/data hooks were preserved. Shared `src/components/ui/*` and global tokens were left alone so pages stay consistent without kit churn.

| Page | Route | Status | Notes |
|------|-------|--------|-------|
| Login | `/login` | DONE | Morning Balance card; visible sign-in errors |
| Dashboard | `/dashboard` | DONE | No hero-metric habits; merged duplicate category cards |
| Transactions | `/transactions` | DONE | **P0:** month picker now filters the list |
| Debts | `/debts` | DONE | Red = you owe · mint = owed to you |
| Friends | `/friends` | DONE | Progressive add flow for returning users |
| Trips (list) | `/trips` | DONE | Overview strip replaces icon-stat grid |
| Trip detail | `/trips/[id]` | DONE | Your balance + first-class AI capture |
| Insights | `/insights` | DONE | Calm analysis; no AI hero chrome |
| LINE | `/line` | DONE | Status-first; settings-parity switches |
| Settings | `/settings` | DONE | Account · Money · Preferences · Data tabs |

---

## Cross-cutting themes

### What was consistently wrong
1. **SaaS / AI-slop scaffolding** — Identical icon+metric card grids, hero-metric tiles, nested cards, decorative mint wells, glass/blur, gradients.
2. **Incomplete product states** — Plain “Loading…”, one-line empties, hover-only row actions, unlabeled icon buttons.
3. **IA drift** — Always-open chrome for rare actions (Friends add); fake/unwired Settings controls; Transactions month picker that didn’t scope the list.
4. **Semantic / money drift** — Hardcoded `฿`, missing `tabular-nums`, inconsistent success/destructive tokens for debt directions.
5. **Motion** — Page-load stagger choreography instead of short state transitions.

### What we standardized
- **Cards:** `rounded-xl` + `shadow-sm` + 1px border; no nested cards; flat `divide-y` lists inside.
- **Money:** `tabular-nums` + semantic amount colors (`amountColorClass` / success / destructive).
- **Loading:** Page-shaped skeletons with `aria-busy`.
- **Empty:** Teach the next action (CTA or clear instruction).
- **Motion:** ~200ms fades; `motion-reduce:animate-none` / `transition-none`.
- **A11y:** Labels, `aria-label`s on icon menus, focus-within for row actions, touch targets ~40–44px.

---

## Page highlights

### Login
Replaced navy glass hero with Morning Balance surface. Brand = **Finance Tracker**. Skeleton loading; destructive Alert on sign-in failure (`auth-context` rethrows).

### Dashboard
Removed dead Download, glass chart overlay, and habit hero tiles. Merged pie + ranking into one category card. Teaching empties for month/debts.

### Transactions
**P0 fix:** selected month filters the list (auto-`loadOlder` when needed). Four staggered summary cards → one sticky ledger strip. Thai labels tightened; infinite scroll preserved.

### Debts
Flat summary cards; cooperative copy; settle dialog shows remaining balance + direction. Settlement payment logic untouched.

### Friends
Add flow collapses when contacts exist. Sent requests show recipient names. Confirms on destructive actions; skeleton list loading.

### Trips (list)
One overview strip instead of three icon-stat cards. Keyboard-activatable trip cards; teaching empties; create dialog labeled.

### Trip detail
**Your balance** in summary; clearer settlement who→whom; AI panel elevated; emoji/celebration empties removed. Sync / Immich / settlement logic untouched.

### Insights
Period-first toolbar; compact stats strip (no health-score hero); tips/anomalies as flat lists. AI hooks unchanged.

### LINE
Connection status + last sync; outline action toolbar; automation as Settings-style switches; sync-log empty state. Mock handlers preserved pending real API wiring.

### Settings
Tabs for progressive disclosure. Removed fake notifications / Compact Mode / fake LINE status. Honest “Coming soon” on Export/Delete. Full EN/TH via `t()`.

---

## Shared follow-ups (out of polish scope)

1. **Live browser QA** — Authenticated pass light/dark + mobile on all routes (agents did not run logged-in visual QA).
2. **i18n gaps** — Dashboard / Insights / LINE still partly English-first; Settings is the model.
3. **Shared motion** — `month-transition.tsx` still uses `duration-300` in places; align when next touched.
4. **Currency ticks** — Some Recharts formatters still hardcode `฿`.
5. **Wire unfinished product** — LINE real APIs; Settings Export/Delete; Login ToS/Privacy links; Transactions delete confirm; Immich/AI provider config forms.
6. **Optional shared primitives** — Teaching empty-state component; friend picker for Debts free-text person field.

---

## Artifact index

| File |
|------|
| [login.md](./impeccable-polish/login.md) |
| [dashboard.md](./impeccable-polish/dashboard.md) |
| [transactions.md](./impeccable-polish/transactions.md) |
| [debts.md](./impeccable-polish/debts.md) |
| [friends.md](./impeccable-polish/friends.md) |
| [trips.md](./impeccable-polish/trips.md) |
| [trip-detail.md](./impeccable-polish/trip-detail.md) |
| [insights.md](./impeccable-polish/insights.md) |
| [line.md](./impeccable-polish/line.md) |
| [settings.md](./impeccable-polish/settings.md) |
| [immich-albums.md](./impeccable-polish/immich-albums.md) |

---

## Immich albums (2026-07-27)

One Immich album per user (`displayName`); trips no longer get separate albums. See [immich-albums.md](./impeccable-polish/immich-albums.md).

---

## Bugfix follow-up (2026-07-27)

- **Dialog dismiss:** Overlay click closes forms again; Select/upload guards remain. Nested Immich lightbox still uses `disableOutsideClose`.
- **Upload panel:** Moved from bottom-right (covered Save) to **top-right**; marked `data-immich-upload-panel` so dismiss no longer closes the transaction form.
- **Select/Popover:** `onCloseAutoFocus` prevented so closing a dropdown does not dismiss the parent form.
- **LINE page:** Removed webhook/token/Developers Console setup; end-user Thai tips only (status, commands, logs, automation UI).
- **Settings:** Already end-user scoped; LINE hint no longer mentions webhooks. Notifications = AI Insights toggles only (no new backend).
