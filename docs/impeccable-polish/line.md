# Impeccable polish — LINE Bot (`/line`)

**Target:** `src/app/(dashboard)/line/page.tsx`  
**Register:** product  
**Quality bar:** Flagship (first-class capture surface per PRODUCT.md)  
**Date:** 2026-07-27  
**Status:** DONE

## Scope

UI/UX polish only. Mock connection data, reconnect handler, automation toggles, and command/log structures preserved. Did not edit `src/components/ui/*`, `globals.css`, `DESIGN.md`, `PRODUCT.md`, backend routes, env, or webhook handlers.

## User-facing cleanup (2026-07-27)

End users were seeing admin/developer LINE channel setup (webhook URL, Channel Access Token / Secret, LINE Developers Console). That content is removed from this page.

| Before | After |
| --- | --- |
| “Configure” CTA implying channel/token setup | Removed |
| Setup card with Developers Console + webhook steps + API docs link | End-user tip card: connected → how to chat with the bot; disconnected → “เชื่อมต่อ LINE” / contact admin or coming soon |
| English-heavy chrome + “Finish setup below” disconnect alert | Clear Thai copy for status, tabs, commands, logs, automation |

Kept for users: connection status, chat commands, sync logs (empty state OK), automation toggles (UI-only, not persisted).

## Drift found → root cause → fix

| Issue | Root cause | Fix |
| --- | --- | --- |
| Heavy `border-2` + mint-tinted status wells | One-off implementation vs DESIGN card vocabulary (1px border, restrained mint) | Standard card; muted icon well; mint only on Connected badge / success affordances |
| Three identical quick-action cards (icon + title + blurb) | Conceptual misalignment — banned identical card grid | Single status card with outline button toolbar |
| Automation rows as bordered mini-cards with tinted Bot icons | One-off vs Settings switch pattern | Flat Label + Switch rows with Separator, matching Settings |
| Copy buttons without labels; switches without `htmlFor` | Missing a11y states | `aria-label` on copy; Label/`htmlFor`/`aria-describedby` on switches |
| Admin webhook/token setup on a user page | Wrong audience for `/line` | Replace with chat tip / connect-soon copy; no developer console links |
| Command rows overflow on narrow viewports | Responsive gap | Stack command / description / copy on mobile |
| No empty path for sync logs | Incomplete edge states | Empty component teaching first LINE command |
| Tab panel motion inconsistent with Debts/Friends | One-off | `animate-in fade-in-0 duration-200` + `motion-reduce:animate-none` |

## Changes by dimension

### Connection status
- Title aligned with nav: **LINE Bot**
- Thai subtitle emphasizes speed-to-capture
- Status badge with `aria-live="polite"` (เชื่อมต่อแล้ว / ยังไม่เชื่อมต่อ)
- Last sync as `<time>`; LINE user id in mono
- Disconnected: destructive Alert + primary “เชื่อมต่อ LINE” CTA (no admin setup pointer)
- Reconnect spinner respects `prefers-reduced-motion`

### Quick actions
- Outline buttons in one card (test message, weekly report, reminder)
- Disabled when disconnected; 44px-class touch height on mobile (`h-10`)

### Tabs
- Horizontally scrollable tab list on small screens
- คำสั่ง / บันทึกซิงก์ / อัตโนมัติ with 200ms fade-in; reduced-motion safe

### Commands
- Category as section headings (not muted eyebrows)
- Divided list (not nested cards)
- Copy → clipboard + toast; check icon feedback

### Sync logs
- Empty state teaches next action
- Success icons muted; errors use destructive semantic only
- Type badges: รายจ่าย / สอบถาม / ข้อผิดพลาด

### Automation
- Settings-parity switch rows with associated labels (UI-only)

### End-user tip (replaces Setup)
- Connected: short steps to use the bot in LINE chat
- Disconnected: friendly connect / contact-admin / coming-soon — no webhook, token, or Developers Console copy

## Checklist

- [x] Aligned to DESIGN.md (cool paper, restrained mint, no nested cards / gradient text / side-stripes)
- [x] Connection status clear (connected + disconnected branches)
- [x] Admin/developer setup hidden from end users
- [x] Settings-style switches
- [x] Tabs usable on mobile
- [x] Empty + error states
- [x] Copy clarity (capture-first, Thai-forward)
- [x] A11y (labels, live region, times, touch targets)
- [x] Motion 150–250ms + reduced-motion
- [x] Logic preserved (mock data + handlers); no backend edits
- [x] No commits

## Follow-ups (out of scope)

- Wire reconnect / quick actions to real LINE APIs
- Persist automation toggles
- Localize via `useLocale` when LINE strings land in i18n
- Soften Settings “LINE Integration” hint (still mentions webhook in i18n)
- Polish Settings “LINE Integration” card for the same status vocabulary
