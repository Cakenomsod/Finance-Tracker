# Settings polish

**Target:** `src/app/(dashboard)/settings/page.tsx` + `src/components/settings/*`  
**Register:** product  
**Prior critique:** `src-app-dashboard-settings-page-tsx` (2026-06-26, 23/40)  
**Quality bar:** flagship polish of shipped surface (honest about unwired actions)

## Drift addressed

| Issue | Root cause | Fix |
|---|---|---|
| Eight same-weight cards, no IA | Conceptual misalignment | Tabs: Account · Money · Preferences · Data |
| Fake notification toggles / Compact Mode / fake LINE status | Conceptual (prototype tail) | Removed local-only toggles; LINE → link to `/line`; Export/Delete disabled + Coming soon |
| EN/TH patchwork on page | Missing i18n keys | All settings page strings via `t()` in `src/lib/i18n.ts` |
| Profile blank flash | One-off (return null) | Card skeleton while loading |
| Categories/recurring spinner | Missing pattern vs DESIGN | Row skeletons |
| Recurring a11y / wrong delete copy / shared CreditCard icon | One-off | aria-labels, recurring-specific delete strings, `Repeat` icon, primary Add CTA |
| Switch/label not associated | One-off | `Label htmlFor` + `aria-describedby` on AI insight switches |
| Mint wash on LINE banner | Token misuse | Removed decorative `bg-primary/10` status strip |
| Budget helper reused “No budget set” | Copy drift | `settings.budgetOptional` |

## What changed

### Page (`page.tsx`)
- Progressive disclosure via tabs (default Account)
- Notifications: only persisted AI Insights weekly/monthly toggles
- Appearance: theme trio only (Dark / Light / System); Compact Mode removed
- AI Services: Immich configured status + test buttons (Immich disabled until configured)
- LINE: honest link-out to `/line` (no fake connected state / webhook)
- Data: Export & Delete Account disabled with Coming soon badge
- Restrained mint (accent only on active theme border + primary CTAs elsewhere)
- Motion: 200ms fades/transitions with `motion-reduce:animate-none` / `motion-reduce:transition-none`
- Responsive: tighter padding on mobile, max-width column, wrapping tab list

### Profile
- Skeleton loading; CardDescription; muted avatar fallback (no mint wash)
- Saving label; labeled email input; currency preview via i18n + `tabular-nums`
- Stacked layout on small screens

### Categories
- Skeleton list; illustrated empty state with CTA
- Color swatches as radiogroup with selected aria; no hover-scale
- Correct budget optional helper; list semantics; `Tags` icon

### Recurring
- Parity with categories: skeleton, empty state + CTA, primary Add, destructive delete dialog with loading
- Form labels (`Name`, htmlFor on fields); responsive row layout

## Persistence preserved

- `saveAiInsightsSettings`, theme (`next-themes`), profile/currency/locale, category CRUD, recurring CRUD, Immich/Local AI test handlers — unchanged in behavior

## Out of scope (follow-ups)

- Full Immich/AI provider config form (`/impeccable craft`)
- Wire Export / Delete Account
- Persist additional notification channels when product supports them

## Verification

- `detect.mjs` on settings targets: **0 findings**
- Auth-gated route: live browser pass not run this session
- Pre-existing TS errors in transactions page unrelated

## End-user scope (2026-07-27)

Confirmed Settings shows no admin credential forms (webhook URL, channel secrets, Immich base URL / API key inputs). LINE card links to `/line` only; Immich / Local AI stay status text + Test buttons (credentials via env / Firestore, not this screen). Notifications keep only persisted AI Insights weekly/monthly toggles. Export / Delete remain disabled Coming soon. Softened LINE hint copy so it no longer mentions webhooks.
