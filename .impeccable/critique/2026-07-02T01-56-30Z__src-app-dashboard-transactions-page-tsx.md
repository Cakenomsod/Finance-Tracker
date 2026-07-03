---
target: transactions
total_score: 26
p0_count: 1
p1_count: 2
timestamp: 2026-07-02T01-56-30Z
slug: src-app-dashboard-transactions-page-tsx
---
## คะแนนสุขภาพการออกแบบ

| # | หลักการ | คะแนน | ประเด็นหลัก |
|---|---------|-------|-------------|
| 1 | การแสดงสถานะระบบ | 3 | skeleton สำหรับ table/mobile ดี; infinite scroll มีข้อความโหลด; badge สถานะ AI ชัด |
| 2 | สอดคล้องกับโลกจริง | 3 | หัวข้อและ empty state เป็นภาษาไทย; label "ยอดสุทธิเดือนนี้" และ "สะสมถึงสิ้นเดือนนี้" ชัดขึ้น แต่ยังมี "Trip Expense", "Me" ปน |
| 3 | การควบคุมและอิสระของผู้ใช้ | 3 | ปุ่มที่ไม่ทำงานถูกลบแล้ว; ยกเลิกฟอร์มได้; ลบรายการยังไม่มี confirm |
| 4 | ความสม่ำเสมอและมาตรฐาน | 3 | shadcn vocabulary สม่ำเสมอ; ภาษาไทย/อังกฤษปนกันไม่เป็นระบบ |
| 5 | การป้องกันข้อผิดพลาด | 3 | TransactionForm validation ดี; ลบธุรกรรมทีละรายการไม่มี confirmation |
| 6 | การจดจำแทนการท่องจำ | 2 | Month picker สื่อว่าดูเดือนนั้น แต่ list ยังแสดงทุกเดือน; desktop ⋯ ซ่อนจน hover |
| 7 | ความยืดหยุ่นและประสิทธิภาพ | 3 | AI capture + Enter submit + infinite scroll ดี; ไม่มี export/bulk/shortcuts |
| 8 | สุนทรียภาพและความเรียบง่าย | 2 | ด้านบนแน่นขึ้น: AI panel + filters + sticky การ์ดสรุป 4 ใบพร้อม stagger |
| 9 | การฟื้นตัวจากข้อผิดพลาด | 3 | empty state มี CTA ภาษาไทย; AI error มี toast |
| 10 | ความช่วยเหลือและเอกสาร | 1 | ไม่มี contextual help สำหรับ Paotang quota, trip debt pending |
| **รวม** | | **26/40** | **Acceptable — ยังต้องปรับก่อนผู้ใช้จะพอใจ** |

## คำตัดสินเรื่อง Anti-Patterns

**LLM assessment**: ไม่ใช่ AI slop แบบ landing page — ใช้ Geist, Morning Balance, shadcn ตรง DESIGN.md แต่ยังมีลักษณะ "SaaS dashboard template" ที่การ์ดสรุป 4 ใบพร้อม staggered fade-in และ sticky bar ที่ใช้ backdrop-blur การเพิ่มการ์ด "เงินสะสมทั้งหมด" ช่วยข้อมูลแต่ทำให้ด้านบนแน่นขึ้น

**Deterministic scan**: 0 findings จาก `detect.mjs` บน `src/app/(dashboard)/transactions/page.tsx` และ `src/components/transactions/`

**Browser visualization**: ไม่สามารถ inject overlay ได้ — `/transactions` redirect ไป `/login` (ต้อง auth) และ browser MCP ไม่มี mutable evaluate API สำหรับ inject `detect.js`

## ภาพรวม

Foundation ยังแข็ง: skeleton, empty state ภาษาไทย, AI capture inline ดี การเพิ่มการ์ด "เงินสะสมทั้งหมด" พร้อมคำอธิบาย "สะสมถึงสิ้นเดือนนี้" ช่วยความชัดของตัวเลข แต่ **Month Picker กับรายการธุรกรรมยังไม่ sync** — ยังเป็นช่องว่าง UX ร้ายแรงที่สุด ผู้ใช้เห็นยอดสรุปของเดือนหนึ่งแต่ list ยังแสดงหลายเดือน

## สิ่งที่ทำได้ดี

1. **AI Quick Capture แบบ inline** — ไม่ modal-first ตรงหลัก "Speed to capture"
2. **การรวม legacy + trip expenses** — badge เป๋าตัง/ค้างจ่ายทริป อธิบาย context ของแต่ละแถวได้ดี
3. **การ์ดเงินสะสม** — `computeCumulativeBalanceUpToMonth` พร้อม microcopy "สะสมถึงสิ้นเดือนนี้" ช่วยให้เข้าใจความต่างจากยอดสุทธิเดือน

## ประเด็นสำคัญ

**[P0] Month picker ไม่กรองรายการธุรกรรม**
- **ทำไมสำคัญ**: `summaryTotals` และ `cumulativeBalance` ใช้ `filterByMonth` แต่ `filteredTransactions` กรองแค่ search + category
- **วิธีแก้**: ใช้ `filterByMonth` กับ list ก่อน group/display
- **คำสั่งแนะนำ**: `/impeccable harden`

**[P1] Cognitive overload ด้านบน — แย่ลงจากการ์ดที่ 4**
- **ทำไมสำคัญ**: ก่อนถึงรายการต้องผ่าน AI panel + filters + sticky month picker + การ์ด 4 ใบ (รายรับ/รายจ่าย/สุทธิ/สะสม) พร้อม stagger 4 ชั้น
- **วิธีแก้**: ยุบ AI panel; รวมยอดสรุปเป็นแถบเดียวหรือ 2 คอลัมน์; ลบ stagger animation
- **คำสั่งแนะนำ**: `/impeccable distill`

**[P1] ภาษาไทย/อังกฤษปนกันไม่เป็นระบบ**
- **ทำไมสำคัญ**: "Trip Expense", paidBy fallback "Me", provider "Local AI/Gemini" ในขณะที่ UI หลักเป็นภาษาไทย
- **วิธีแก้**: แปลข้อความ user-facing ให้สม่ำเสมอ
- **คำสั่งแนะนำ**: `/impeccable clarify`

**[P2] ปุ่ม action บน desktop ซ่อนจน hover**
- **ทำไมสำคัญ**: `opacity-0 group-hover:opacity-100` บนปุ่ม ⋯ ไม่มี aria-label
- **วิธีแก้**: แสดงตลอดหรือ `focus-within:opacity-100`; เพิ่ม aria-label
- **คำสั่งแนะนำ**: `/impeccable audit`

**[P2] ไม่มี contextual help สำหรับแนวคิดเฉพาะ**
- **ทำไมสำคัญ**: Paotang quota, trip debt pending ต้องอ่าน microcopy เล็กๆ
- **วิธีแก้**: tooltip หรือ help icon ข้าง badge ที่ซับซ้อน
- **คำสั่งแนะนำ**: `/impeccable onboard`

## Red Flags ตาม Persona

**Alex (Power User)**: Month picker ไม่กรอง list — ไว้ใจไม่ได้ว่ากำลังดู ledger เดือนเดียว; ไม่มี export/bulk

**Jordan (First-Timer)**: เปลี่ยนเดือนแล้วยังเห็นรายการเดือนอื่น — คิดว่าแอปพัง; การ์ด 4 ใบทำให้ไม่รู้ว่าควรโฟกัสอันไหน

**Sam (Accessibility)**: ปุ่ม ⋯ ซ่อนจน hover ไม่มี aria-label; การ์ดสรุป 4 ใบบน mobile (grid-cols-2) อ่านยาวก่อนถึง list

## ข้อสังเกตเล็กน้อย

- Stagger animation 4 ชั้น (0/45/90/135ms) ใกล้ choreographed page load
- ลบรายการไม่มี confirmation
- note ใช้ emoji 📝 แทน icon component

## คำถามที่ควรพิจารณา

- ถ้า month picker กรอง list ได้แล้ว ยังต้องมี month group dividers ในตารางหรือไม่?
- การ์ด "เงินสะสม" ควรอยู่บนหน้านี้หรือย้ายไป Dashboard?
- AI panel ควรยุบเป็นค่าเริ่มต้นหรือไม่?
