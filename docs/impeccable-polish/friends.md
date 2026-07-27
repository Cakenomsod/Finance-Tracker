# Impeccable polish — Friends

**Target:** `src/app/(dashboard)/friends/page.tsx`, `src/components/friends/*`  
**Register:** product  
**Quality bar:** flagship (aligned to DESIGN.md + prior critique)  
**Prior critique:** `src-app-dashboard-friends-page-tsx` (score 24/40, 2026-06-26)  
**Hooks / logic:** preserved (`useFriends` untouched)

## Drift resolved

| Issue | Root cause | Fix |
|---|---|---|
| Add forms always dominate viewport | Conceptual misalignment (first-run IA for returning users) | Single add panel; collapsed behind “เพิ่มรายชื่อ” when contacts exist; always open when empty |
| Two competing add cards | One-off layout vs restrained product surfaces | One card + account/custom method switcher |
| Text “กำลังโหลด...” | Missing design-system pattern | Skeleton list rows matching contact row height |
| Sent tab shows “??” | Incomplete use of existing `toDisplayName` | Display recipient name + initials avatar |
| Empty pending/sent were blank | Missing empty-state pattern | Teach-next-action empty states with optional CTA |
| English “Friends” + Thai body | Copy inconsistency | Title → “เพื่อน” |
| Icon-only delete, weak drag a11y | Incomplete interaction states | `aria-label`s, confirm dialogs, up/down reorder controls |
| Accept/decline no busy state | Missing loading feedback | Per-request busy disable + confirm on decline/cancel |

## Changes shipped

### Information architecture
- Contact list / requests are the primary surface for returning users
- Add flow is progressive disclosure, not permanent chrome
- After sending a friend request, UI switches to “ส่งแล้ว” so status is visible immediately

### Visual / DESIGN.md
- Cooperative Mint only on primary actions, success copy, friend badge, and drop highlight
- Cards: `rounded-xl` + `shadow-sm`, no nested cards, no side-stripes, no gradient text
- Cool Morning Balance neutrals only
- Motion: `duration-200` fade / color transitions with `motion-reduce:animate-none` / `motion-reduce:transition-none`

### Requests UX
- Inbound: accept with busy state; decline confirms
- Outbound: shows `toDisplayName` (fallback: truncated user id); cancel confirms
- Tab badges: count on friends, destructive count on pending, secondary count on sent

### List / reorder
- Drag handle with `aria-grabbed` + keyboard-accessible up/down buttons
- Alias edit labeled; confirm before deleting custom contacts
- Responsive: actions wrap; touch-friendly control sizes

### Forms / a11y
- Labeled email + custom-name fields
- Email format check before submit
- `role="alert"` / `role="status"` for errors and success
- Tabs wrap on narrow viewports

### Related
- `contact-select.tsx`: `aria-busy` / `aria-label` on trigger only (shared picker, no logic change)

## Checklist

- [x] Aligned to DESIGN.md / product register
- [x] IA matches returning-user vs first-run needs
- [x] Skeleton loading (not centered spinner text)
- [x] Empty states teach next action
- [x] Destructive actions confirmed
- [x] Focus / labels / aria on key controls
- [x] Reduced motion respected
- [x] Hooks/logic preserved
- [x] Did not edit `src/components/ui/*`, `globals.css`, DESIGN.md, PRODUCT.md, or other pages

## Out of scope / follow-ups

- Removing registered friends from this page (no API surface in current hooks)
- Full dnd-kit keyboard sensors (up/down buttons cover a11y path)
- Linking custom contacts to real accounts later
