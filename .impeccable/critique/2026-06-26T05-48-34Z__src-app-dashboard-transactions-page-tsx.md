---
target: transactions
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-06-26T05-48-34Z
slug: src-app-dashboard-transactions-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton loaders สำหรับ table/mobile ดี; infinite scroll มีข้อความโหลด; AI job badges ชัด |
| 2 | Match System / Real World | 3 | หัวข้อและ empty state เป็นภาษาไทยแล้ว แต่ badge "Trip Expense", "Me", "Local AI/Gemini" ยังอังกฤษ |
| 3 | User Control and Freedom | 3 | ปุ่มตกแต่งที่ไม่ทำงานถูกลบแล้ว; มี cancel บนฟอร์ม; ลบรายการยังไม่มี confirm |
| 4 | Consistency and Standards | 3 | shadcn vocabulary สม่ำเสมอ; ภาษาไทย/อังกฤษปนกันไม่เป็นระบบในทุกชั้น |
| 5 | Error Prevention | 3 | TransactionForm validation ดี; ลบธุรกรรมทีละรายการไม่มี confirmation dialog |
| 6 | Recognition Rather Than Recall | 2 | Month picker สื่อว่ากำลังดูเดือนนั้น แต่ list ยังแสดงทุกเดือน; desktop ⋯ ซ่อนจน hover |
| 7 | Flexibility and Efficiency | 3 | AI quick capture + Enter submit + infinite scroll ดี; ไม่มี export/bulk/keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 2 | ด้านบนแน่น: AI panel + filters + sticky 3 stat cards; stagger animation บน summary |
| 9 | Error Recovery | 3 | Empty state มี CTA ภาษาไทยและล้างตัวกรอง; AI error มี toast |
| 10 | Help and Documentation | 1 | ไม่มี contextual help สำหรับ Paotang quota, trip debt pending, หรือความหมายของ month picker |
| **Total** | | **26/40** | **Acceptable — ต้องปรับก่อนผู้ใช้จะพอใจ** |

## Anti-Patterns Verdict

**LLM assessment**: ไม่ใช่ AI slop แบบ landing page — ใช้ Geist, Morning Balance cool neutrals, shadcn ตรง DESIGN.md และ PRODUCT.md anti-references ได้ดี แต่ยังมีลักษณะ "SaaS dashboard template" ที่ summary cards 3 ใบพร้อม staggered fade-in และ sticky bar ที่ใช้ backdrop-blur ซึ่งใกล้ glassmorphism โดยไม่จำเป็น การรวม legacy + trip expenses ทำได้ดีด้วย badge แต่ cognitive load ด้านบนสูง

**Deterministic scan**: 0 findings จาก `detect.mjs` บน `src/app/(dashboard)/transactions/page.tsx` และ `src/components/transactions/`

**Browser visualization**: ไม่สามารถ inject overlay บนหน้า Transactions ได้ — redirect ไป `/login?from=%2Ftransactions` (ต้อง auth) และ browser MCP ไม่มี mutable evaluate API สำหรับ inject `detect.js` บนหน้า login loading state

## Overall Impression

Foundation แข็งขึ้นจากรอบก่อน: skeleton loaders, empty state ภาษาไทย, และการลบปุ่มที่ยังไม่ wired ช่วยความน่าเชื่อถือ แต่ **Month Picker กับรายการธุรกรรมยังไม่ sync กัน** ยังเป็นช่องว่าง UX ที่ร้ายแรงที่สุด — ผู้ใช้เห็นยอดสรุปของเดือนหนึ่งแต่ list ยังแสดงหลายเดือนพร้อม month dividers ทำให้สับสนและไม่ไว้ใจตัวเลข

## What's Working

1. **AI Quick Capture บนหน้า Transactions** — inline input ไม่ modal-first ตรง principle "Speed to capture"; placeholder ภาษาไทยชัดเจน
2. **การรวม legacy + trip expenses** — badge เป๋าตัง/ค้างจ่ายทริป และ secondary amount lines ช่วยอธิบาย context ของแต่ละแถว
3. **Mobile FAB + skeleton loading** — FAB วางเหนือ bottom nav ถูก thumb zone; skeleton แทน centered spinner ตรง DESIGN.md

## Priority Issues

**[P0] Month picker ไม่กรองรายการธุรกรรม**
- **Why it matters**: `summaryTotals` ใช้ `filterByMonth` แต่ `filteredTransactions` กรองแค่ search + category — ผู้ใช้เลือกเดือนแล้วเห็นยอดของเดือนนั้นแต่ list ยังมี month dividers ของเดือนอื่น
- **Fix**: ใช้ `filterByMonth(filteredTransactions, selectedMonth.year, selectedMonth.month)` ก่อน group/display; ซ่อน month dividers ถ้าเหลือเดียว
- **Suggested command**: `/impeccable harden`

**[P1] Cognitive overload ด้านบนของหน้า**
- **Why it matters**: ก่อนถึงรายการต้องผ่าน AI panel (provider select + badge + receipt section) + search/filter + sticky month picker + 3 animated stat cards — ขัด principle "Clarity before ceremony"
- **Fix**: ยุบ AI panel เป็น collapsed/expand; ลด stagger animation บน summary; พิจารณา inline month totals แทน 3 cards
- **Suggested command**: `/impeccable distill`

**[P1] ภาษาไทย/อังกฤษปนกันไม่เป็นระบบ**
- **Why it matters**: หัวข้อเป็นภาษาไทย แต่ "Trip Expense", paidBy fallback "Me", split mode "Solo/Equal/By item", provider "Local AI/Gemini" ทำให้ Jordan สับสน
- **Fix**: แปล badge/label ที่ user-facing เป็นภาษาไทยสม่ำเสมอ หรือกำหนดกฎ bilingual ชัดเจน
- **Suggested command**: `/impeccable clarify`

**[P2] Desktop row actions ซ่อนจน hover**
- **Why it matters**: ปุ่ม ⋯ ใช้ `opacity-0 group-hover:opacity-100` — keyboard/touch บน desktop hybrid ไม่เห็น; mobile แสดงตลอดแต่ desktop ไม่สม่ำเสมอ
- **Fix**: ใช้ `opacity-100` หรือ `focus-within:opacity-100`; เพิ่ม `aria-label="ตัวเลือกธุรกรรม"` บน trigger
- **Suggested command**: `/impeccable audit`

**[P2] ไม่มี contextual help สำหรับแนวคิดเฉพาะ**
- **Why it matters**: Paotang quota cap, trip debt pending ("ยังไม่นับในรายจ่าย"), และความแตกต่าง personal share vs full amount ต้องอ่าน microcopy เล็กๆ
- **Fix**: tooltip หรือ inline help icon ข้าง badge ที่ซับซ้อน; ลิงก์ไป docs สั้นๆ
- **Suggested command**: `/impeccable onboard`

## Persona Red Flags

**Alex (Power User)**: Month picker ไม่กรอง list — ไม่สามารถไว้ใจว่ากำลังดู ledger เดือนเดียว; ไม่มี export CSV หรือ bulk edit; ลบทีละรายการผ่าน dropdown 3 คลิก

**Jordan (First-Timer)**: เลือนเดือนใน MonthPicker แล้วยังเห็นรายการเดือนอื่นใน list — คิดว่าแอปพัง; badge "Trip Expense" ไม่มีคำอธิบายว่าทำไมแก้ไขไม่ได้; AI provider select มีทั้ง dropdown และ badge ซ้ำซ้อน

**Sam (Accessibility)**: Desktop MoreHorizontal ซ่อนจน hover และไม่มี aria-label; sticky summary ใช้ backdrop-blur อาจลด contrast บนบางจอ; uppercase tracked labels ใน trip detail dialog ("ผู้จ่าย") อ่านยากสำหรับ screen reader flow

## Minor Observations

- Stagger animation บน 3 summary cards (`animationDelay` 0/45/90ms) ใกล้ choreographed page load แม้มี `motion-reduce:animate-none`
- AI panel แสดง provider ทั้ง Select และ Badge ซ้ำกัน
- `note` prefix ใช้ emoji 📝 แทน icon component — อาจ render ต่างกันข้าม OS
- Delete action ไม่มี confirmation — เสี่ยง misclick โดยเฉพาะบน mobile dropdown

## Questions to Consider

- ถ้า month picker กรอง list ได้แล้ว ยังต้องมี month group dividers ในตารางหรือไม่?
- AI panel ควรเป็น default expanded หรือ collapsed สำหรับผู้ใช้ที่ log ด้วยมือเป็นหลัก?
- ควรมี export หรือ share รายการเดือนก่อนเพิ่ม filter อื่นๆ หรือไม่?
