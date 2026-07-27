# Login — Impeccable polish

**Page:** Login  
**Path:** `src/app/login/page.tsx`

## What was wrong

- Dark navy canvas (`#0B1020`) with blur orbs and a gradient footer accent — navy “hero” vibe, not Morning Balance cool paper.
- Glassmorphic card (`backdrop-blur-xl`, translucent background) — banned decorative glass.
- Oversized logo tile with mint glow shadow (`shadow-lg shadow-primary/20`) — Cooperative Mint used for decoration beyond the ≤10% / action-only rule.
- Primary CTA oversized (`h-12`, heavy shadows) vs design-system button vocabulary (`rounded-md`, `h-9`/`h-10`, subtle lift).
- Brand truncated to “Finance”; supporting copy was generic and ceremonial.
- Auth session loading used a pulse logo + “Loading…” instead of a card-shaped skeleton.
- Sign-in failures only hit `console.error`; no visible error recovery. `AuthContext.signInWithGoogle` also swallowed errors so the page could never surface them.
- Suspense fallback used light muted text on the dark canvas (contrast risk).

## What you changed

- `src/app/login/page.tsx` — Rebuilt around Morning Balance `bg-background` + default `Card` (`rounded-xl`, `shadow-sm`, solid surface). Removed glass, blur orbs, and gradient accents.
- `src/app/login/page.tsx` — Logo tile aligned to system (32–40px mint square, `rounded-lg`, no glow). Title set to **Finance Tracker**; clearer product-led description and sign-in prompt.
- `src/app/login/page.tsx` — CTA uses `size="lg"` / `min-h-11`, state-only transitions (`duration-200`, `motion-reduce`), `Loader2` + “Signing in…” loading label, `aria-busy`.
- `src/app/login/page.tsx` — Card-shaped `LoginSkeleton` for auth + Suspense loading; pulse respects `motion-reduce`.
- `src/app/login/page.tsx` — Destructive `Alert` for sign-in failures (popup blocked, network, generic); silent cancel for closed/cancelled popup.
- `src/components/auth-context.tsx` — Re-throws after logging so the login page can show error states (UX blocker for polish).

## Remaining follow-ups

- Wire real Terms of Service / Privacy Policy links when those routes exist (footer copy is placeholder).
- Optional: shared auth error mapper if other entry points gain Google sign-in.
- Visual QA in the running app (light/dark, mobile width, keyboard focus ring) — not run in this pass.
