# File Tree: Finance-Tracker

**Generated:** 5/28/2026, 10:28:55 PM
**Root Path:** `d:\Work\Project\Finance Tracker\Finance-Tracker`

```
├── 📁 .continue
│   └── 📁 agents
├── 📁 .github
│   └── 📁 workflows
│       ├── ⚙️ firebase-hosting-merge.yml
│       └── ⚙️ firebase-hosting-pull-request.yml
├── 📁 public
│   ├── 🖼️ favicon.svg
│   └── 🖼️ icons.svg
├── 📁 scripts
├── 📁 src
│   ├── 📁 app
│   │   ├── 📁 (dashboard)
│   │   │   ├── 📁 analytics
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 debts
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 friends
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 insights
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 line
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 settings
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 transactions
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📁 trips
│   │   │   │   ├── 📁 [tripId]
│   │   │   │   │   └── 📄 page.tsx
│   │   │   │   └── 📄 page.tsx
│   │   │   ├── 📄 layout.tsx
│   │   │   └── 📄 page.tsx
│   │   ├── 📁 api
│   │   │   ├── 📁 ai
│   │   │   │   ├── 📁 chat
│   │   │   │   │   └── 📁 message
│   │   │   │   │       └── 📄 route.ts
│   │   │   │   ├── 📁 expense
│   │   │   │   │   └── 📁 parse
│   │   │   │   │       └── 📄 route.ts
│   │   │   │   ├── 📁 receipt
│   │   │   │   │   └── 📁 parse
│   │   │   │   │       └── 📄 route.ts
│   │   │   │   ├── 📁 test
│   │   │   │   │   └── 📄 route.ts
│   │   │   │   └── 📁 transaction
│   │   │   │       └── 📁 parse
│   │   │   │           └── 📄 route.ts
│   │   │   ├── 📁 auth
│   │   │   │   └── 📁 session
│   │   │   │       └── 📄 route.ts
│   │   │   └── 📁 immich
│   │   │       ├── 📁 asset
│   │   │       │   └── 📁 [id]
│   │   │       │       └── 📄 route.ts
│   │   │       ├── 📁 delete
│   │   │       │   └── 📄 route.ts
│   │   │       ├── 📁 test
│   │   │       │   └── 📄 route.ts
│   │   │       └── 📁 upload
│   │   │           └── 📄 route.ts
│   │   ├── 📁 login
│   │   │   └── 📄 page.tsx
│   │   ├── 🎨 globals.css
│   │   └── 📄 layout.tsx
│   ├── 📁 components
│   │   ├── 📁 ai
│   │   │   ├── 📄 ai-expense-quick-input.tsx
│   │   │   └── 📄 ai-receipt-review-dialog.tsx
│   │   ├── 📁 transactions
│   │   │   ├── 📄 transaction-ai-panel.tsx
│   │   │   └── 📄 transaction-form.tsx
│   │   ├── 📁 trips
│   │   │   ├── 📄 member-picker.tsx
│   │   │   ├── 📄 member-tag-input.tsx
│   │   │   ├── 📄 trip-ai-panel.tsx
│   │   │   ├── 📄 trip-expense-form.tsx
│   │   │   └── 📄 trip-settings-fields.tsx
│   │   ├── 📁 ui
│   │   │   ├── 📄 accordion.tsx
│   │   │   ├── 📄 alert-dialog.tsx
│   │   │   ├── 📄 alert.tsx
│   │   │   ├── 📄 aspect-ratio.tsx
│   │   │   ├── 📄 avatar.tsx
│   │   │   ├── 📄 badge.tsx
│   │   │   ├── 📄 breadcrumb.tsx
│   │   │   ├── 📄 button-group.tsx
│   │   │   ├── 📄 button.tsx
│   │   │   ├── 📄 calendar.tsx
│   │   │   ├── 📄 card.tsx
│   │   │   ├── 📄 carousel.tsx
│   │   │   ├── 📄 chart.tsx
│   │   │   ├── 📄 checkbox.tsx
│   │   │   ├── 📄 collapsible.tsx
│   │   │   ├── 📄 command.tsx
│   │   │   ├── 📄 context-menu.tsx
│   │   │   ├── 📄 dialog.tsx
│   │   │   ├── 📄 drawer.tsx
│   │   │   ├── 📄 dropdown-menu.tsx
│   │   │   ├── 📄 empty.tsx
│   │   │   ├── 📄 field.tsx
│   │   │   ├── 📄 form.tsx
│   │   │   ├── 📄 hover-card.tsx
│   │   │   ├── 📄 input-group.tsx
│   │   │   ├── 📄 input-otp.tsx
│   │   │   ├── 📄 input.tsx
│   │   │   ├── 📄 item.tsx
│   │   │   ├── 📄 kbd.tsx
│   │   │   ├── 📄 label.tsx
│   │   │   ├── 📄 menubar.tsx
│   │   │   ├── 📄 navigation-menu.tsx
│   │   │   ├── 📄 pagination.tsx
│   │   │   ├── 📄 popover.tsx
│   │   │   ├── 📄 progress.tsx
│   │   │   ├── 📄 radio-group.tsx
│   │   │   ├── 📄 resizable.tsx
│   │   │   ├── 📄 scroll-area.tsx
│   │   │   ├── 📄 select.tsx
│   │   │   ├── 📄 separator.tsx
│   │   │   ├── 📄 sheet.tsx
│   │   │   ├── 📄 sidebar.tsx
│   │   │   ├── 📄 skeleton.tsx
│   │   │   ├── 📄 slider.tsx
│   │   │   ├── 📄 sonner.tsx
│   │   │   ├── 📄 spinner.tsx
│   │   │   ├── 📄 switch.tsx
│   │   │   ├── 📄 table.tsx
│   │   │   ├── 📄 tabs.tsx
│   │   │   ├── 📄 textarea.tsx
│   │   │   ├── 📄 toast.tsx
│   │   │   ├── 📄 toaster.tsx
│   │   │   ├── 📄 toggle-group.tsx
│   │   │   ├── 📄 toggle.tsx
│   │   │   ├── 📄 tooltip.tsx
│   │   │   ├── 📄 use-mobile.tsx
│   │   │   └── 📄 use-toast.ts
│   │   ├── 📄 app-sidebar.tsx
│   │   ├── 📄 auth-context.tsx
│   │   └── 📄 theme-provider.tsx
│   ├── 📁 hooks
│   │   ├── 📄 use-all-trip-expenses.ts
│   │   ├── 📄 use-auth.ts
│   │   ├── 📄 use-debts.ts
│   │   ├── 📄 use-friends.ts
│   │   ├── 📄 use-mobile.ts
│   │   ├── 📄 use-toast.ts
│   │   ├── 📄 use-transactions.ts
│   │   ├── 📄 use-trip-debts.ts
│   │   ├── 📄 use-trip-expenses.ts
│   │   ├── 📄 use-trip-settlements.ts
│   │   ├── 📄 use-trips.ts
│   │   └── 📄 use-user-settings.ts
│   ├── 📁 lib
│   │   ├── 📁 ai
│   │   │   ├── 📄 env.ts
│   │   │   ├── 📄 expense-text-heuristic.ts
│   │   │   ├── 📄 gemma.ts
│   │   │   ├── 📄 index.ts
│   │   │   ├── 📄 local-response.ts
│   │   │   ├── 📄 local.ts
│   │   │   ├── 📄 parse-json.ts
│   │   │   ├── 📄 receipt-mapper.ts
│   │   │   └── 📄 receipt-schema.ts
│   │   ├── 📁 immich
│   │   │   ├── 📄 asset-ids.ts
│   │   │   ├── 📄 client.ts
│   │   │   └── 📄 delete-from-browser.ts
│   │   ├── 📁 tax
│   │   │   ├── 📄 calculate.ts
│   │   │   └── 📄 countries.ts
│   │   ├── 📄 api-auth.ts
│   │   ├── 📄 firebase-admin.ts
│   │   ├── 📄 firebase.ts
│   │   ├── 📄 firestore-types.ts
│   │   ├── 📄 firestore.ts
│   │   ├── 📄 photo-firebase-admin.ts
│   │   ├── 📄 sync-expense-transaction.ts
│   │   ├── 📄 trip-currency.ts
│   │   └── 📄 utils.ts
│   └── 📄 middleware.ts
├── 📁 styles
│   └── 🎨 globals.css
├── ⚙️ .env.example
├── ⚙️ .firebaserc
├── ⚙️ .gitignore
├── ⚙️ .hintrc
├── 📝 README.md
├── 📝 Stracture.md
├── ⚙️ firebase.json
├── 📄 next-env.d.ts
├── 📄 next.config.mjs
├── ⚙️ package-lock.json
├── ⚙️ package.json
├── 📄 postcss.config.mjs
├── 📄 tailwind.config.js
├── ⚙️ tsconfig.json
└── 📄 tsconfig.tsbuildinfo
```

---
*Generated by FileTree Pro Extension*