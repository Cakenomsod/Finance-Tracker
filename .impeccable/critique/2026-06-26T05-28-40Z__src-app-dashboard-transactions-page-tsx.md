---
target: transactions
total_score: 24
p0_count: 1
p1_count: 3
timestamp: 2026-06-26T05-28-40Z
slug: src-app-dashboard-transactions-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | โหลดรายการใช้ข้อความ "Loading..." แทน skeleton; infinite scroll และสถานะ AI job ดี |
| 2 | Match System / Real World | 3 | Paotang/ทริป badge เป็นภาษาไทยดี แต่หัวหน้าและ empty state ยังอังกฤษล้วน |
| 3 | User Control and Freedom | 2 | ปุ่ม Date Range, Export, Sort, Bulk actions ยังไม่ทำงาน |
| 4 | Consistency and Standards | 3 | shadcn vocabulary สม่ำเสมอ; ภาษาไทย/อังกฤษปนกันไม่เป็นระบบ |
| 5 | Error Prevention | 3 | TransactionForm มี validation ดี; bulk delete ยังไม่มี confirm |
| 6 | Recognition Rather Than Recall | 2 | ปุ่ม ⋯ ซ่อนจนกว่า hover; ปุ่ม Calendar เป็น icon-only |
| 7 | Flexibility and Efficiency | 3 | AI quick capture + infinite scroll ดี; ไม่มี keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | ด้านบนแน่น: AI panel + filters + 3 stat cards + sticky month bar |
| 9 | Error Recovery | 2 | Empty state ไม่ชี้ทาง; AI error มีข้อความ |
| 10 | Help and Documentation | 1 | ไม่มี contextual help สำหรับ Paotang, trip debt, month picker |
| **Total** | | **24/40** | **Acceptable — ต้องปรับก่อนผู้ใช้จะพอใจ** |

## Anti-Patterns Verdict

**LLM assessment**: ไม่ใช่ AI slop แบบ landing page — ใช้ Geist, Morning Balance, shadcn ตรง DESIGN.md แต่มีลักษณะ "SaaS dashboard template" ที่ summary cards 3 ใบพร้อม stagger animation และ toolbar ที่มีปุ่มตกแต่งแต่ยังไม่ wired

**Deterministic scan**: 0 findings จาก `detect.mjs` บน `src/app/(dashboard)/transactions` และ `src/components/transactions`

**Browser visualization**: ไม่สามารถ inject overlay บนหน้า Transactions ได้ — redirect ไป `/login` และ browser MCP ไม่มี mutable evaluate API สำหรับ inject `detect.js`

## Overall Impression

Foundation แข็ง: design system ชัด, AI capture เป็น first-class, mobile FAB และ infinite scroll คิดมาดี แต่ **Month Picker กับรายการธุรกรรมไม่ sync กัน** เป็นช่องว่าง UX ที่ร้ายแรงที่สุด และมี UI controls หลายตัวที่ดูใช้งานได้แต่ยังไม่ทำอะไร

## What's Working

1. **AI Quick Capture บนหน้า Transactions** — inline input ไม่ modal-first ตรง principle "Speed to capture"
2. **การรวม legacy + trip expenses** — badge เป๋าตัง/ทริป/ค้างจ่าย ช่วยให้เข้าใจ context ของแต่ละแถว
3. **Mobile FAB + bottom nav clearance** — `bottom-[calc(4.5rem+env(safe-area-inset-bottom))]` วางถูก thumb zone

## Priority Issues

**[P0] Month picker ไม่กรองรายการธุรกรรม**
- Why: ผู้ใช้เลือกเดือนแล้วเห็นยอด summary ของเดือนนั้น แต่ list ยังแสดงทุกเดือนที่โหลดมา — สับสนและไม่ไว้ใจตัวเลข
- Fix: ใช้ `filterByMonth` กับ `filteredTransactions` ก่อน group/display
- Command: `/impeccable harden`

**[P1] UI controls ที่ยังไม่ทำงาน**
- Why: Date Range, Export, column sort, bulk Add Tags/Edit Category/Delete — ทำให้ไม่ไว้ใจ interface
- Fix: wire handlers หรือซ่อน/disable จนกว่าจะพร้อม
- Command: `/impeccable harden`

**[P1] Empty state ไม่สอนขั้นตอนถัดไป**
- Why: "No transactions found." ไม่บอกให้ Add หรือล้าง filter
- Fix: CTA "Add Transaction" + คำแนะนำล้าง filter (มี hint ภาษาไทยบางส่วนแล้ว)
- Command: `/impeccable onboard`

**[P1] Loading state ไม่ตรง design system**
- Why: DESIGN.md ระบุ skeleton ไม่ใช่ centered text
- Fix: skeleton rows สำหรับ mobile list และ desktop table
- Command: `/impeccable polish`

**[P2] Row actions ซ่อนจน hover**
- Why: keyboard/touch ไม่เห็นปุ่ม ⋯; opacity-0 group-hover
- Fix: แสดงเสมอหรือใช้ visible focus-within
- Command: `/impeccable audit`

## Persona Red Flags

**Alex (Power User)**: Sort/Export/Bulk ไม่ทำงาน — ไม่มีทาง batch ลบหรือ export CSV; ต้องคลิกทีละรายการ

**Jordan (First-Timer)**: เลือกเดือนแล้ว list ยังมีเดือนอื่น — คิดว่า app พัง; ปุ่ม Calendar ไม่มี label

**Sam (Accessibility)**: MoreHorizontal ซ่อนจน hover; checkbox + row click ซับซ้อน; ไม่มี aria-label บน filter icon buttons

## Minor Observations

- Stagger animation บน summary cards ใกล้ choreographed page load (มี motion-reduce แล้ว)
- Sticky summary ใช้ backdrop-blur — ยอมรับได้สำหรับ sticky แต่ใกล้ glass trope
- Bilingual: header อังกฤษ, AI/ Paotang ไทย — ควรกำหนด pattern
- Desktop table ซ่อน mobile list ด้วย `hidden md:block` — pattern ดี

## Questions to Consider

- ถ้า month picker กรอง list แล้ว infinite scroll ควรโหลดเฉพาะเดือนนั้นหรือทุกเดือน?
- Bulk actions จำเป็นจริงไหม หรือ distill ออกก่อน?
- Summary 3 cards ควรอยู่ sticky หรือย้ายไป dashboard?
