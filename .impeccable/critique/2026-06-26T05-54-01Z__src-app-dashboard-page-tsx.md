---
target: dashboard
total_score: 25
p0_count: 0
p1_count: 3
timestamp: 2026-06-26T05-54-01Z
slug: src-app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | ใช้ spinner กลางหน้าจอแทน skeleton; การโหลดข้อมูลเก่าในกราฟมี hint ภาษาไทยดี |
| 2 | Match System / Real World | 2 | ข้อความส่วนใหญ่เป็นภาษาอังกฤษ ทั้งที่ผู้ใช้หลักเป็นคนไทย |
| 3 | User Control and Freedom | 3 | MonthPicker ย้อน/เลื่อนเดือนได้ดี; dialog มี cancel |
| 4 | Consistency and Standards | 3 | shadcn vocabulary สม่ำเสมอ แต่ Insights card ใช้ gradient ต่างจาก card อื่น |
| 5 | Error Prevention | 3 | จำกัดเดือนที่มีข้อมูล; ค่า default สมเหตุสมผล |
| 6 | Recognition Rather Than Recall | 2 | กราฟเลื่อนแนวนอนซ่อน affordance; ปุ่ม MoreHorizontal ไม่บอกชัดว่าไป Analytics |
| 7 | Flexibility and Efficiency | 2 | ไม่มี keyboard shortcut; ไม่มี quick capture บนหน้า dashboard |
| 8 | Aesthetic and Minimalist Design | 2 | widget เยอะเกินไป 4 stat cards น้ำหนักเท่ากันหมด |
| 9 | Error Recovery | 3 | n/a ส่วนใหญ่; empty state ไม่มีทางกู้คืน inline |
| 10 | Help and Documentation | 2 | Insights panel ช่วยบ้าง แต่ไม่มี contextual help สำหรับมือใหม่ |
| **Total** | | **25/40** | **Acceptable — ต้องปรับก่อนผู้ใช้จะพอใจ** |

## Anti-Patterns Verdict

**LLM assessment**: ไม่ถึงขั้น "AI slop" ชัดเจน — ใช้ Geist, Morning Balance neutrals, Cooperative Mint อย่างมีวินัย ตรง DESIGN.md ส่วนใหญ่ แต่ยังมีสัญญาณ SaaS dashboard template: กริด StatCard 4 ใบเหมือนกัน (icon + label + ตัวเลขใหญ่ + badge %) ซึ่ง PRODUCT.md และ DESIGN.md ห้ามไว้ชัด การ์ด Insights ใช้ `bg-gradient-to-br` เป็นตกแต่ง ขัดหลัก "Clarity before ceremony"

**Deterministic scan**: `detect.mjs` บน `page.tsx` และ `components/dashboard` — 0 findings

**Browser visualization**: ไม่สามารถ inject overlay บน dashboard ได้ — redirect ไป `/login` (ต้อง auth) จึงไม่มี overlay ให้ดูในเบราว์เซอร์

## Overall Impression

Dashboard มีฐานดี: design system ชัด, ตัวเลขใช้ tabular-nums, motion รองรับ reduced-motion, กราฟรายได้-รายจ่ายเลื่อนดูย้อนหลังได้ฉลาด แต่หน้านี้พยายามทำทุกอย่างพร้อมกัน — overview, analytics, หนี้, insights — จนผู้ใช้ไทยที่เปิดมาเช้าๆ ไม่รู้ว่าควรมองอะไรก่อน โอกาสใหญ่สุดคือลด cognitive load และทำให้ภาษา/การกระทำหลักสอดคล้องกับ "speed to capture"

## What's Working

1. **Month transition system** — `MonthContentTransition` + `MonthAnimatedValue` มี `motion-reduce:animate-none` เปลี่ยนเดือนรู้สึกต่อเนื่องไม่สะดุด
2. **Semantic color สำหรับหนี้** — แดง = คุณเป็นหนี้, mint = คนอื่นหนี้คุณ ตรง Semantic Lock Rule
3. **Income vs Expenses scroll chart** — โหลดข้อมูลเก่าเมื่อเลื่อนซ้าย + hint ภาษาไทย เป็น pattern ที่คิดมาสำหรับผู้ใช้จริง

## Priority Issues

### [P1] Information overload — widget เยอะเกินไป
- **Why**: ผู้ใช้เปิด dashboard เพื่อตอบ "วันนี้/เดือนนี้เป็นยังไง" แต่เจอ 8+ section พร้อมกัน เกิน working memory (≤4)
- **Fix**: เลือก hero metric เดียว (เช่น Net Cash Flow) ให้ใหญ่กว่า stat อื่น; ย้าย analytics ลึกไป /analytics; ใช้ progressive disclosure
- **Suggested command**: `/impeccable distill dashboard`

### [P1] Hero-metric StatCard grid — template SaaS ที่ brand ห้าม
- **Why**: 4 cards รูปแบบเดียวกัน (icon well + title + ตัวเลข + % vs last month) คือ anti-pattern ใน DESIGN.md
- **Fix**: รวม income/expense/net เป็นแถวเดียวหรือ sparkline; ลด icon wells; เน้นตัวเลขเดียวที่สำคัญ
- **Suggested command**: `/impeccable layout dashboard stat cards`

### [P1] Bilingual gap — ภาษาอังกฤษทั้งหน้า ทั้งที่ผู้ใช้หลักเป็นคนไทย
- **Why**: PRODUCT.md ระบุ "Bilingual by default" แต่ dashboard เกือบทั้งหมดเป็นภาษาอังกฤษ (ยกเว้น hint กราฟและ RecurringDueCard)
- **Fix**: ใช้ `useLocale` + `t()` เหมือน recurring card; หัวข้อ stat, empty state, insights labels เป็นสองภาษา
- **Suggested command**: `/impeccable clarify dashboard copy`

### [P2] Loading state ใช้ spinner กลางจอ
- **Why**: DESIGN.md ระบุ skeleton ไม่ใช่ spinner; รู้สึกช้าและไม่บอกโครงสร้างหน้า
- **Fix**: skeleton สำหรับ stat grid + chart placeholders
- **Suggested command**: `/impeccable polish dashboard loading`

### [P2] Empty states ไม่สอนขั้นตอนถัดไป
- **Why**: "No transaction data yet" ไม่มีปุ่ม Add — ขัดหลัก onboard/empty state ใน DESIGN.md
- **Fix**: CTA ชัด "เพิ่มรายการแรก" เปิด Quick Add หรือ TransactionForm
- **Suggested command**: `/impeccable onboard dashboard empty states`

## Persona Red Flags

**Alex (Power User)**: ไม่มี quick capture บนหน้า dashboard ต้องไป sidebar/FAB; ไม่มี keyboard shortcut; คลิก transaction ต้องเปิด dialog ทีละรายการ ไม่มี bulk; `isAddDialogOpen` มี state แต่ไม่มี trigger บนหน้า (dead code)

**Sam (Accessibility)**: แถว Recent Transactions เป็น `<div onClick>` ไม่ใช่ button/link — keyboard และ screen reader ใช้ยาก; กราฟ Recharts มักไม่ accessible โดย default; hint เลื่อนซ้ายมี `aria-hidden` เมื่อไม่ loading

**Natt (ผู้ใช้ไทย บันทึกรายจ่ายทุกวัน)**: เปิดมาเจอ "Welcome back! Here's your financial overview" ไม่รู้สึกเป็นเครื่องมือของตัวเอง; ตัวเลขสำคัญกระจาย 4 การ์ด ไม่รู้ว่าควรดูอันไหนก่อน; active trip แสดงเป็นภาษาอังกฤษเล็กๆ ใน subtitle

## Minor Observations

- Insights card: `border-primary/20 bg-gradient-to-br` — ตกแต่งเกินจำเป็น ขัด One Voice Rule
- ปุ่ม `MoreHorizontal` ไป Analytics — affordance คลุมเครือ ควรเป็น "ดู Analytics" หรือ BarChart3 icon
- Category pie แสดงแค่ top 3 ใน legend — ที่เหลือหายไปโดยไม่บอก
- `formatRelativeDate` เป็นภาษาอังกฤษเสมอ ("Today", "Yesterday")
- Debt Summary มี nested tinted boxes ใน card — ใกล้ nested card แต่ยังพอรับได้

## Questions to Consider

- ถ้า dashboard มีแค่ 3 สิ่งที่ผู้ใช้ต้องการเห็นทุกเช้า จะเลือกอะไร?
- Quick Add / AI capture ควรอยู่บนหน้านี้เลยไหม แทนที่จะซ่อนใน nav?
- ผู้ใช้ไทยควรเห็นภาษาไทยเป็นค่าเริ่มต้น หรือสลับตาม locale ทั้งแอป?
