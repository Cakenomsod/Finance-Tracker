---
name: Finance Tracker
description: A personal finance operating system — clear numbers, cooperative shared money, fast capture.
colors:
  cooperative-mint: "oklch(0.55 0.17 162.48)"
  cooperative-mint-foreground: "oklch(0.98 0.005 250)"
  morning-balance-bg: "oklch(0.98 0.005 250)"
  morning-balance-ink: "oklch(0.18 0.02 250)"
  morning-balance-surface: "oklch(1 0 250)"
  morning-balance-muted: "oklch(0.94 0.01 250)"
  morning-balance-muted-ink: "oklch(0.50 0.02 250)"
  morning-balance-border: "oklch(0.90 0.01 250)"
  morning-balance-input: "oklch(0.92 0.01 250)"
  sidebar-surface: "oklch(0.97 0.005 250)"
  alert-red: "oklch(0.577 0.245 27.325)"
  alert-amber: "oklch(0.70 0.18 70)"
  chart-expense: "oklch(0.577 0.245 27.325)"
  chart-income: "oklch(0.55 0.17 162.48)"
typography:
  display:
    fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
  body:
    fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "'Geist', 'Geist Fallback', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "normal"
  mono:
    fontFamily: "'Geist Mono', 'Geist Mono Fallback', monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "16px"
spacing:
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.cooperative-mint}"
    textColor: "{colors.cooperative-mint-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.cooperative-mint}"
    textColor: "{colors.cooperative-mint-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "{colors.morning-balance-surface}"
    textColor: "{colors.morning-balance-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.morning-balance-ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
  badge-default:
    backgroundColor: "{colors.cooperative-mint}"
    textColor: "{colors.cooperative-mint-foreground}"
    rounded: "{rounded.md}"
    padding: "2px 8px"
  card-default:
    backgroundColor: "{colors.morning-balance-surface}"
    textColor: "{colors.morning-balance-ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
---

# Design System: Finance Tracker

## 1. Overview

**Creative North Star: "The Trusted Ledger"**

Finance Tracker looks like a ledger you trust with friends: cool, precise surfaces where numbers stay legible, and Cooperative Mint appears only where money moves, confirms, or settles. The system serves Thai personal-finance users juggling solo spending, shared debts, and group trips — clarity before ceremony, speed to capture, bilingual by default.

Morning Balance neutrals provide an everyday-use calm: light, clear, cool blue-gray paper — never warm cream, never lifestyle-brand fluff. Soft and confident components (gentle curves, generous padding, approachable without playful-fintech energy) keep shared-money flows cooperative rather than confrontational. Delight comes from how well the tool works, not from mascots, streaks, or confetti.

This system explicitly rejects PRODUCT.md anti-references: no neon gradients or gamification, no navy-and-gold hero-metric dashboards, no dense corporate-banking jargon chrome. The tool should disappear into the task.

**Key Characteristics:**

- Restrained accent usage — Cooperative Mint on primary actions, positive balances, and success states only
- Single sans family (Geist) across all UI; tabular nums for money
- Subtle lift elevation — cards and floating panels carry a whisper of shadow; borders and tonal layers do the rest
- Full light/dark support with mirrored semantic tokens
- shadcn/ui + Radix primitives for familiar, accessible affordances
- Bilingual-ready: mixed Thai/English copy, ฿ formatting, legible at compact densities

## 2. Colors

A cool Morning Balance neutral family (hue ~250) with one social accent: Cooperative Mint (hue ~162). Semantic colors for destructive, warning, and chart roles are standardized and never repurposed as decoration.

### Primary

- **Cooperative Mint** (oklch(0.55 0.17 162.48) / ~#1a9970): Primary buttons, active nav, positive "owed to you" amounts, success states, focus rings, chart income series. Friendly enough for shared debts; restrained enough for daily solo capture.
- **Cooperative Mint (Dark)** (oklch(0.696 0.17 162.48)): Dark-mode primary — slightly brighter for contrast on deep surfaces.

### Secondary

- **Morning Balance Muted** (oklch(0.94 0.01 250)): Secondary buttons, muted icon wells, inactive chip backgrounds.
- **Sidebar Accent** (oklch(0.92 0.01 250)): Sidebar hover and active item backgrounds — one step cooler/darker than content surface.

### Tertiary

- **Chart Amber** (oklch(0.70 0.18 70)): Secondary chart series, warning-adjacent data viz only.
- **Chart Violet** (oklch(0.60 0.12 300)): Tertiary chart series for category breakdowns.

### Neutral

- **Morning Balance Background** (oklch(0.98 0.005 250)): App canvas, primary reading surface in light mode.
- **Morning Balance Ink** (oklch(0.18 0.02 250)): Body text, headings, primary icons.
- **Morning Balance Surface** (oklch(1 0 250)): Cards, popovers, elevated panels — pure white with cool cast.
- **Morning Balance Muted Ink** (oklch(0.50 0.02 250)): Labels, descriptions, placeholders — must maintain ≥4.5:1 on background.
- **Morning Balance Border** (oklch(0.90 0.01 250)): Card borders, dividers, input strokes.
- **Morning Balance Input** (oklch(0.92 0.01 250)): Input fill tint in light mode; dark mode uses oklch(0.22 0.02 250).
- **Sidebar Surface** (oklch(0.97 0.005 250)): Navigation panel — slightly cooler than content bg.
- **Alert Red** (oklch(0.577 0.245 27.325)): Destructive actions, "you owe" amounts, expense chart series, error states.

### Named Rules

**The One Voice Rule.** Cooperative Mint appears on ≤10% of any screen. Its rarity signals action and confirmation — never wallpaper, never decorative gradients.

**The Cool Paper Rule.** Neutrals stay on hue ~250 with chroma ≤0.02. Warm cream, sand, parchment, and beige body backgrounds are forbidden — warmth lives in Cooperative Mint and copy tone, not in the canvas.

**The Semantic Lock Rule.** Red is debt/expense/destructive. Mint is income/success/primary action. Amber is warning only. Never swap roles for visual variety.

## 3. Typography

**Display Font:** Geist (with Geist Fallback, system-ui, sans-serif)
**Body Font:** Geist (same stack — single-family product UI)
**Label/Mono Font:** Geist Mono (with Geist Mono Fallback, monospace) — IDs, codes, monospace data when needed

**Character:** Clean geometric sans tuned for dense financial data. Friendly through weight and spacing, not through display type or script faces. Thai and English coexist at the same scale without feeling bolted on.

### Hierarchy

- **Display** (600, 1.5rem/2xl responsive, line-height 1.25, tracking-tight): Page titles — "Dashboard", "Transactions". Fixed rem scale, not fluid clamp.
- **Headline** (600, 1.25rem/xl, line-height 1.25): Section headers within cards, dialog titles.
- **Title** (600, 0.875rem/sm, line-height 1): Card titles, stat labels, table column headers.
- **Body** (400, 0.875rem/sm, line-height 1.5): Default UI copy, form labels, list items. Prose blocks cap at 65–75ch.
- **Label** (500, 0.75rem/xs, line-height 1.33): Badges, sidebar group labels, chart axis ticks, mobile bottom nav (10px compact).
- **Money** (600–700, inherits size context, `tabular-nums`): All currency amounts — balances, transaction rows, chart tooltips.

### Named Rules

**The Single Voice Rule.** Geist carries headings, buttons, labels, body, and data. No display/body pairing. No serif, no script, no gradient text.

**The Tabular Money Rule.** Every monetary value uses `tabular-nums`. Amounts align in lists, tables, and dashboard stat cards without ragged digits.

## 4. Elevation

Subtle lift: depth is conveyed primarily through borders and tonal surface shifts, with a whisper of shadow on cards and floating panels so content separates from Morning Balance background without SaaS-dashboard heaviness. Overlays (dropdowns, popovers, sheets, dialogs) earn stronger shadows because they must read above scrolling content.

Flat elements (inputs, outline buttons) use `shadow-xs` — a hairline depth cue. Cards use `shadow-sm`. Floating sidebar (inset variant) and chart tooltips use `shadow-sm` to `shadow-xl` depending on z-layer. Modals and sheets use `shadow-lg` with semi-transparent scrims.

Dark mode reduces shadow reliance; borders and surface lightness steps carry more of the separation.

### Shadow Vocabulary

- **Hairline** (`shadow-xs`): Inputs, selects, outline buttons, checkboxes — barely-there lift at rest.
- **Card** (`shadow-sm`): Dashboard cards, inset sidebar content area, active tabs.
- **Overlay** (`shadow-md`): Dropdown menus, select popovers, hover cards.
- **Floating** (`shadow-lg` / `shadow-xl`): Context menus, chart tooltips, mobile sheets.

### Named Rules

**The Subtle Lift Rule.** Cards and floating panels always carry a whisper of shadow. Resting surfaces are never naked on the canvas — border + shadow-sm minimum.

**The Overlay Escalation Rule.** Shadow strength scales with z-index layer. Dropdown < dialog < toast. Never use shadow-lg on a static card.

## 5. Components

Soft and confident: gentle curves (10–16px radius), generous internal padding, standard shadcn affordances. Every interactive component ships default, hover, focus-visible, active, disabled, and error states.

### Buttons

- **Shape:** Gently rounded (10px / rounded-md), height 36px default (32px sm, 40px lg)
- **Primary:** Cooperative Mint fill, Morning Balance near-white text, 8px 16px padding, `transition-all`
- **Hover / Focus:** Primary dims to 90% opacity; focus-visible gets 3px ring at ring/50 opacity in Cooperative Mint
- **Secondary:** Morning Balance Muted fill, darker ink text, hover at 80% opacity
- **Outline:** Border + background surface, shadow-xs, hover shifts to accent tint
- **Ghost / Link:** No fill; ghost hovers accent background; link is Cooperative Mint with underline on hover
- **Destructive:** Alert Red fill, white text, red-tinted focus ring

### Chips / Badges

- **Style:** rounded-md, 0.75rem text, font-medium, 2px 8px padding
- **Default:** Cooperative Mint fill; **Secondary:** muted fill; **Outline:** border only with hover accent
- **Notification:** Destructive fill, rounded-full, 10px text — pending friend requests, counts

### Cards / Containers

- **Corner Style:** Generous curve (16px / rounded-xl)
- **Background:** Morning Balance Surface on Morning Balance Background
- **Shadow Strategy:** shadow-sm at rest; no nested cards
- **Border:** 1px Morning Balance Border
- **Internal Padding:** 24px horizontal (px-6), 24px vertical (py-6), 24px gap between header and content

### Inputs / Fields

- **Style:** 36px height, rounded-md (10px), 1px Morning Balance Input border, transparent bg (dark: input/30 tint), shadow-xs
- **Focus:** Border shifts to Cooperative Mint ring, 3px ring at 50% opacity
- **Error:** Destructive border + destructive/20 focus ring
- **Placeholder:** Morning Balance Muted Ink — must pass 4.5:1 contrast
- **Selection highlight:** Cooperative Mint bg with foreground text

### Navigation

- **Desktop Sidebar:** Sidebar Surface bg, grouped sections (Overview / Insights / Integrations), 14px menu items with 16px icons. Active item: sidebar-accent bg + medium weight. Logo tile: 32px Cooperative Mint square with rounded-lg.
- **Mobile Bottom Nav:** Fixed bottom bar, border-top, bg-background/95 with backdrop-blur. 5-icon layout with center Quick Add FAB in Cooperative Mint. Active route: Cooperative Mint icon + label; inactive: muted-foreground.
- **Header actions:** Ghost icon buttons, Command+K search trigger, Quick Add primary button.

### AI Quick Capture (signature)

- **Style:** Sparkles-accented input area for natural-language and receipt expense parsing
- **Character:** Inline, not modal-first — textarea + attach + send, job status badges (processing/done/error) with Thai status copy
- **States:** Processing spinner, success check, error alert — semantic colors only, no confetti

## 6. Do's and Don'ts

### Do:

- **Do** use Cooperative Mint exclusively for primary actions, positive balances, and success — its scarcity is the brand.
- **Do** render all money with `tabular-nums` and locale-aware ฿ formatting.
- **Do** keep cards at rounded-xl (16px) with shadow-sm + 1px border — the default container vocabulary.
- **Do** use 3px focus rings in Cooperative Mint at 50% opacity on all interactive elements.
- **Do** support `prefers-reduced-motion: reduce` — crossfade or instant state changes, no choreographed page loads.
- **Do** maintain WCAG 2.1 AA contrast, especially muted-foreground on Morning Balance Background.
- **Do** use skeleton loaders for content areas, not centered spinners in blank space.
- **Do** write empty states that teach the next action ("Add your first transaction", not "Nothing here").

### Don't:

- **Don't** use neon gradients, mascots, streaks, badges-as-gamification, or confetti on every action — PRODUCT.md forbids overly playful fintech.
- **Don't** ship navy-and-gold hero metrics, identical icon-card grids, gradient text, or side-stripe callouts — generic SaaS dashboard tropes are banned.
- **Don't** adopt dense corporate-banking jargon chrome or slow multi-step flows for simple tasks.
- **Don't** use warm cream/sand/parchment body backgrounds — Morning Balance cool neutrals only.
- **Don't** nest cards inside cards.
- **Don't** use Cooperative Mint as decorative fill on large surface areas or chart backgrounds.
- **Don't** reach for modals when inline or progressive disclosure would serve the task faster.
- **Don't** pair a second sans or use display fonts in buttons, labels, or data tables.
- **Don't** animate layout properties for page-load choreography — motion conveys state change only, 150–250ms.
