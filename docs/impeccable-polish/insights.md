# Impeccable polish — Insights

**Target:** `src/app/(dashboard)/insights/page.tsx`  
**Related:** `src/components/shared/month-picker.tsx`, `week-picker.tsx` (reduced-motion only)  
**Register:** product · Trusted Ledger  
**Quality bar:** flagship  
**Critique prior:** `src-app-dashboard-insights-page-tsx` (2026-06-26, score 13/40 — mock-era; P0 mock data already resolved in product code)

## Verdict

**DONE** — Insights now reads as a calm analysis surface: period controls first, compact period stats (not a hero score), prose summary, then tabbed detail. AI hooks/logic unchanged.

## Drift resolved

| Issue | Root cause | Fix |
|---|---|---|
| Sparkles mint icon well + “powered by Gemini” subtitle | Conceptual — AI branding ceremony | Plain page title + “Period analysis…” copy; mint reserved for actions/positive amounts |
| Tinted highlight cards + dashed tip card grid | One-off SaaS scaffolding | Surface cards with muted icon wells; tips as one divided list card |
| Nested cards on Unusual Activity | Card wrapping bordered row-cards | Single card + `divide-y` anomaly rows |
| Empty tabs in nested Cards | Same nested-card pattern | Dashed muted empty panels with teaching copy |
| Generating = spinner in blank card | Missing system pattern | Skeleton matching ready layout + status line |
| Spin / tab / reveal motion without reduced-motion | Incomplete a11y | `motion-reduce:animate-none`; 150–200ms fades only |
| Period pickers year-slide ignores reduced-motion | Shared control gap | `motion-reduce:animate-none` on Month/Week pickers |

## What changed

- **Hierarchy:** Header → period toolbar → stats strip → summary → Highlights / Tips / Unusual
- **Stats:** One divided card (income / expenses / net / count); semantic colors; no health-score hero
- **Tips / anomalies:** Flat lists inside one card — no nested cards
- **Empty / error / loading:** Teaching empty, retryable error, skeleton for load + generate
- **a11y:** `aria-live` status, period `role="group"`, busy buttons, responsive tab labels
- **Motion:** State fades 200ms; spin respects reduced motion

## Preserved

- `useAiInsight`, period keys, generate/refresh, report shape rendering

## Checklist (polish.md)

- [x] Design system aligned (no gradient text, side-stripes, nested cards, warm cream)
- [x] Loading / empty / error teach next action
- [x] Tabular money + semantic amount colors
- [x] `prefers-reduced-motion`
- [x] Detector clean on page (`detect.mjs` → `[]`)
- [ ] Live authenticated browser pass (login redirect in prior critique; not re-verified here)

## Follow-ups (out of scope)

- URL-sync tab/period query params
- Deep-link anomalies to transactions
- Thai/English copy via locale strings
