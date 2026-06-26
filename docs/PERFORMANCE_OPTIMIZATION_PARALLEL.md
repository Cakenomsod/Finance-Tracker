# Performance Optimization — Parallel Work Spec

> **Purpose:** ให้ AI หลายตัวทำงานคู่ขนานได้โดยไม่ชนกัน  
> **Project:** Finance Tracker (Next.js + Firestore)  
> **Last updated:** 2025-06-25

---

## การตัดสินใจจาก Product (ห้ามเปลี่ยนโดยไม่ถาม user)

| หัวข้อ | การตัดสินใจ |
|--------|-------------|
| Pagination รายการธุรกรรม | **โหลดทีละ 50 รายการ** (cursor `limit(50)` + `startAfter`) + infinite scroll — แทน 7-day windows (อัปเดต 2025-06-26) |
| Analytics | **real-time (`onSnapshot`)** — แก้รายการแล้วกราฟต้องอัปเดตทันที |
| Dashboard กราฟ | โหลดเริ่มต้น **6 เดือนล่าสุด** — ข้อมูลเก่ากว่านั้น **โหลดเพิ่มเมื่อ user เลื่อนดูกราฟ** |
| โครงสร้าง Firestore path | **ไม่ย้าย** เป็น `users/{uid}/...` ในรอบนี้ |

---

## เป้าหมายรวม

1. ลด Firebase document reads
2. ลด listener ซ้ำซ้อนบน client
3. โหลดเร็วขึ้น โดยเฉพาะ Dashboard และ Transactions
4. คง UX real-time สำหรับ Analytics และการแก้ไขรายการ

---

## ลำดับการทำงาน (สำคัญสำหรับ parallel)

```
Phase 0 (Foundation)     ──► ต้อง merge ก่อน หรือทุก agent อ่าน contract นี้แล้วสร้างไฟล์ใหม่เท่านั้น
        │
        ├── Phase 1 (Providers)      ─┐
        ├── Phase 2a (Dashboard)     ─┤  ทำคู่ขนานได้ ถ้าแตะเฉพาะไฟล์ใน ownership matrix
        ├── Phase 2b (Transactions)  ─┤
        ├── Phase 2c (Analytics)     ─┤
        ├── Phase 2d (Paotang)       ─┤
        └── Phase 3 (Trips)          ─┘
        │
Phase INTEGRATION          ──► agent เดียว หรือทำหลัง merge ทุก phase
```

**กฎ parallel:** แต่ละ phase **ห้ามแก้ไฟล์นอก ownership** ของตัวเอง ยกเว้น Phase INTEGRATION

---

## Phase 0 — Foundation (ทำก่อน / หรือ agent แรก)

**Branch แนะนำ:** `perf/phase-0-foundation`

### สร้างไฟล์ใหม่เท่านั้น (ห้ามแก้ hook/page เดิม)

| ไฟล์ | หน้าที่ |
|------|--------|
| `src/lib/firestore-query/date-windows.ts` | คำนวณช่วงวันที่ 7 วัน, 6 เดือน, เดือนก่อนหน้า |
| `src/lib/firestore-query/types.ts` | shared types สำหรับ query options |
| `src/lib/firestore-query/merge-snapshots.ts` | รวมผลหลาย query window โดย dedupe ตาม doc id |
| `firestore.indexes.json` | composite indexes (ดูท้ายเอกสาร) |

### API Contract (ทุก phase ต้องใช้)

```typescript
// src/lib/firestore-query/types.ts

export type DateWindow = {
  /** inclusive start (start of day, local) */
  start: Date;
  /** inclusive end (end of day, local) */
  end: Date;
  label: string; // debug: "2025-06-19..2025-06-25"
};

export type WindowedQueryState<T> = {
  items: T[];
  loading: boolean;
  error: Error | null;
  /** วันที่เก่าสุดที่โหลดแล้ว (start of oldest window) */
  oldestLoaded: Date | null;
  /** วันที่ใหม่สุดที่โหลดแล้ว */
  newestLoaded: Date | null;
  hasMoreOlder: boolean;
  loadOlder: () => void;
  loadNewer?: () => void; // optional สำหรับ refresh ช่วงล่าสุด
};

// 7-day windows — นับถอยจากวันนี้
export function buildInitial7DayWindow(): DateWindow;
export function buildOlder7DayWindow(before: Date): DateWindow;

// Dashboard chart windows — 6 เดือนต่อ chunk
export function buildInitial6MonthWindow(): DateWindow;
export function buildOlder6MonthWindow(before: Date): DateWindow;

// Analytics range → DateWindow จากค่า dropdown
export function analyticsRangeToWindow(range: '1month' | '3months' | '6months' | '1year'): DateWindow;
```

### `date-windows.ts` — logic ที่ต้อง implement

```typescript
// 7 วันล่าสุด (รวมวันนี้): วันนี้ 00:00 ถึง วันนี้ 23:59:59
buildInitial7DayWindow()

// 7 วันก่อนหน้า window ปัจจุบัน:
// end = วันก่อน oldestLoaded 1 วัน (end of day)
// start = end - 6 วัน (start of day)
buildOlder7DayWindow(oldestLoaded: Date)

// Dashboard: 6 เดือนปฏิทินล่าสุด
buildInitial6MonthWindow() // เช่น 2025-01-01 .. 2025-06-30

// โหลดเพิ่มเมื่อเลื่อนกราฟ: 6 เดือนก่อนหน้า chunk
buildOlder6MonthWindow(before: Date)
```

### `merge-snapshots.ts`

- รับ `Map<docId, T>` หรือ array ของ arrays
- dedupe by `id`
- sort by `date` desc (ใช้ `toDateFromFirestore` จาก `src/lib/datetime.ts`)

### Acceptance criteria Phase 0

- [ ] มี unit-style tests หรืออย่างน้อย exported functions พร้อม JSDoc
- [ ] `npx tsc --noEmit` ผ่าน
- [ ] ยังไม่แก้ hook/page เดิม

---

## Phase 1 — Shared Data Providers

**Branch:** `perf/phase-1-providers`  
**ขึ้นกับ:** Phase 0 types (import ได้)

### เป้าหมาย

listener ต่อ collection **แค่ 1 ตัว** ตลอด session แทน hook ซ้ำใน layout + ทุกหน้า

### สร้างไฟล์ใหม่

| ไฟล์ | หน้าที่ |
|------|--------|
| `src/providers/finance-data-provider.tsx` | root provider รวม sub-contexts |
| `src/providers/transactions-context.tsx` | subscribe + CRUD |
| `src/providers/trips-context.tsx` | trips list |
| `src/providers/debts-context.tsx` | debts (from + to listeners รวมใน provider เดียว) |
| `src/hooks/use-transactions-context.ts` | thin wrapper `useTransactions()` |
| `src/hooks/use-trips-context.ts` | thin wrapper `useTrips()` |
| `src/hooks/use-debts-context.ts` | thin wrapper `useDebts()` |

### แก้ไฟล์ (ownership Phase 1 เท่านั้น)

| ไฟล์ | การเปลี่ยนแปลง |
|------|----------------|
| `src/app/(dashboard)/layout.tsx` | wrap `<FinanceDataProvider>` รอบ `QuickAddProvider` |
| `src/hooks/use-transactions.ts` | re-export จาก context **หรือ** deprecate แล้วให้ import จาก `use-transactions-context.ts` |
| `src/hooks/use-trips.ts` | เหมือนด้านบน |
| `src/hooks/use-debts.ts` | เหมือนด้านบน |
| `src/components/quick-add-context.tsx` | ใช้ context แทน subscribe เอง (ลบ duplicate listener) |

### Context API (contract สำหรับ phase อื่น)

```typescript
// transactions-context — Phase 2 จะขยาย options ต่อ
interface TransactionsContextValue {
  transactions: Transaction[];
  loading: boolean;
  error: Error | null;
  addTransaction: (...) => Promise<...>;
  editTransaction: (...) => Promise<...>;
  removeTransaction: (...) => Promise<...>;
}

// trips-context
interface TripsContextValue {
  trips: Trip[];
  activeTrips: Trip[];
  closedTrips: Trip[];
  loading: boolean;
  // ... CRUD เดิมจาก use-trips.ts
}

// debts-context
interface DebtsContextValue {
  debts: Debt[];
  loading: boolean;
  // ... CRUD เดิมจาก use-debts.ts
}
```

### ห้ามทำใน Phase 1

- ห้ามเพิ่ม date filter / pagination (เป็นหน้าที่ Phase 2)
- ห้ามแก้ `transactions/page.tsx`, `analytics/page.tsx`, `page.tsx` (dashboard)

### Acceptance criteria

- [ ] เปิด Dashboard แล้วมี listener `transactions` แค่ 1 ตัว (ตรวจใน DevTools Network/Firestore debug)
- [ ] QuickAdd ยัง add transaction ได้
- [ ] `tsc --noEmit` ผ่าน

---

## Phase 2a — Dashboard (6 เดือน + lazy load เก่ากว่า)

**Branch:** `perf/phase-2a-dashboard`  
**ขึ้นกับ:** Phase 0 `date-windows.ts`

### Ownership ไฟล์

| แก้ได้ | ห้ามแก้ |
|--------|---------|
| `src/hooks/use-dashboard-data.ts` (**ใหม่**) | `use-transactions.ts` core |
| `src/app/(dashboard)/page.tsx` | `transactions-context.tsx` (Phase 1) |
| `src/lib/aggregate-transactions.ts` (ถ้าจำเป็น helper เล็กๆ) | Phase 2b/2c files |

### พฤติกรรมที่ต้องได้

1. **โหลดครั้งแรก:** legacy transactions + trip expenses ในช่วง **6 เดือนล่าสุด** เท่านั้น
2. **กราฟรายเดือน (`monthlyData`):** สร้างจากข้อมูลที่โหลดแล้ว
3. **เลื่อนดูข้อมูลเก่า:** เมื่อ user เลื่อน/โต้ตอบกับกราฟรายเดือน (แนะนำ: ปุ่ม "โหลดข้อมูลเก่ากว่า" หรือ detect scroll ซ้ายสุดของ chart) → เรียก `loadOlder6Months()`
4. **Recent transactions (5 รายการ):** จากข้อมูลใน memory — ไม่ query แยก
5. **Debts / tripDebts:** ยังใช้ hook เดิมในรอบนี้ได้ (Phase 3 จะรวมทีหลัง) — แต่ห้ามโหลด `useTransactions()` แบบเต็มก้อนซ้ำ

### Hook ใหม่ `useDashboardData()`

```typescript
export function useDashboardData(userId: string | undefined): {
  transactions: Transaction[];
  tripExpenses: TripExpense[];
  loading: boolean;
  loadOlderChartData: () => void;
  hasOlderChartData: boolean;
  chartLoadingOlder: boolean;
}
```

**Query pattern (transactions):**

```typescript
query(
  collection(db, 'transactions'),
  where('userId', '==', uid),
  where('date', '>=', Timestamp.fromDate(window.start)),
  where('date', '<=', Timestamp.fromDate(window.end)),
  orderBy('date', 'desc')
)
```

**Trip expenses:** ใช้ `tripId in [...]` จำกัด 30 trips เหมือนเดิม แต่ filter `date` ฝั่ง client หรือเพิ่ม `where date` ถ้ามี index

### UI สำหรับ lazy load กราฟ

ใน `page.tsx` บริเวณ BarChart รายเดือน:

- แสดงปุ่ม ghost: **"โหลดข้อมูลเก่ากว่า"** เมื่อ `hasOlderChartData`
- หรือ `onMouseMove` / custom brush ที่ขอบซ้ายของ chart → trigger `loadOlderChartData`
- แสดง `Loader2` ขณะ `chartLoadingOlder`

### Acceptance criteria

- [ ] Dashboard ไม่เรียก `useTransactions()` แบบโหลดทั้งหมด
- [ ] กราฟ 6 เดือนแสดงถูกต้อง
- [ ] กดโหลดเก่ากว่าแล้วกราฟขยายย้อนหลังได้
- [ ] `tsc --noEmit` ผ่าน

---

## Phase 2b — Transactions Page (7 วันต่อครั้ง)

**Branch:** `perf/phase-2b-transactions-pagination`  
**ขึ้นกับ:** Phase 0 `date-windows.ts`

### Ownership ไฟล์

| แก้ได้ | ห้ามแก้ |
|--------|---------|
| `src/hooks/use-windowed-transactions.ts` (**ใหม่**) | `page.tsx` dashboard |
| `src/hooks/use-windowed-trip-expenses.ts` (**ใหม่**) | analytics |
| `src/app/(dashboard)/transactions/page.tsx` | providers (Phase 1) |

### พฤติกรรม

1. โหลดครั้งแรก: **7 วันล่าสุด** (legacy tx + trip expenses ที่ user มีส่วน)
2. รายการแสดงแยกวันด้วย `groupItemsByDate` เหมือนเดิม
3. เมื่อ scroll ถึงท้ายรายการ (หรือปุ่ม **"โหลด 7 วันก่อนหน้า"**) → `loadOlder()` ดึง window ก่อนหน้า
4. **Real-time:** ใช้ `onSnapshot` ต่อ window ที่ active — เมื่อแก้รายการในช่วงที่โหลดแล้วต้องอัปเดต
5. Filter/search ฝั่ง client ทำงานกับข้อมูลที่โหลดแล้วเท่านั้น — แสดง hint ถ้าค้นหาแล้วไม่เจอ: *"ลองโหลดข้อมูลย้อนหลังเพิ่ม"*

### Hook `useWindowedTransactions`

```typescript
export function useWindowedTransactions(
  userId: string | undefined
): WindowedQueryState<Transaction> & {
  addTransaction: ...;
  editTransaction: ...;
  removeTransaction: ...;
}
```

**Implementation notes:**

- เก็บ `loadedWindows: DateWindow[]` ใน state
- แต่ละ window = 1 `onSnapshot` หรือรวมเป็น query เดียวถ้า merge range ได้
- แนะนำ: **1 listener ต่อ window** แล้ว merge ด้วย `merge-snapshots.ts`
- เมื่อ `loadOlder()`: เพิ่ม window ใหม่ + subscribe
- อย่า unsubscribe window เก่า (user อาจ scroll กลับ)

### Trip expenses บนหน้า Transactions

- `useWindowedTripExpenses` — logic คล้ายกัน filter by date window
- ยัง merge ด้วย `getTripExpenseUserShare` / logic เดิมใน `transactions/page.tsx`

### UI

- ด้านล่างตาราง/mobile list: ปุ่ม **"โหลด 7 วันก่อนหน้า"** + loading state
- Optional: IntersectionObserver ที่ sentinel div แทนปุ่ม

### `existingTransactions` ใน TransactionForm

- Phase 2b **ไม่ส่ง** `transactions` ทั้งก้อน
- ส่งเฉพาะ `usePaotangUsage` จาก Phase 2d (หรือชั่วคราวส่งแค่ window ปัจจุบัน + หมายเหตุใน code)

### Acceptance criteria

- [ ] เปิดหน้า Transactions โหลดแค่ ~7 วันแรก
- [ ] โหลดเพิ่มแล้วเห็นกลุ่มวันเก่าขึ้น
- [ ] Add/Edit/Delete ยังทำงาน + list อัปเดต real-time
- [ ] `groupItemsByDate` ยังถูกต้อง

---

## Phase 2c — Analytics (real-time + scoped by range)

**Branch:** `perf/phase-2c-analytics`  
**ขึ้นกับ:** Phase 0 `analyticsRangeToWindow`

### Ownership

| แก้ได้ | ห้ามแก้ |
|--------|---------|
| `src/hooks/use-analytics-data.ts` (**ใหม่**) | dashboard page |
| `src/app/(dashboard)/analytics/page.tsx` | transactions page |

### พฤติกรรม

1. **คง `onSnapshot`** — ห้ามเปลี่ยนเป็น `getDocs` one-shot
2. Query จำกัดตาม dropdown range (`1month` / `3months` / `6months` / `1year`)
3. เมื่อเปลี่ยน range → unsubscribe เก่า → subscribe ช่วงใหม่
4. แก้ transaction แล้วกราฟอัปเดตภายใน listener เดิม

### Hook

```typescript
export function useAnalyticsData(
  userId: string | undefined,
  range: '1month' | '3months' | '6months' | '1year'
): {
  combined: CombinedTransaction[]; // ใช้ mergeTransactions
  loading: boolean;
  error: Error | null;
}
```

### Query

```typescript
const window = analyticsRangeToWindow(range);
// transactions: userId + date range + orderBy date desc
// trip_expenses: tripIds in chunk + filter date (client or composite index)
```

### ลบ duplicate helpers

- ถ้า `analytics/page.tsx` มี `filterByTimeRange` ซ้ำกับ `aggregate-transactions.ts` → ใช้ตัวกลางอย่างใดอย่างหนึ่ง

### Acceptance criteria

- [ ] Analytics ไม่โหลด transactions ทั้งประวัติ
- [ ] เปลี่ยน range แล้วข้อมูลเปลี่ยน
- [ ] แก้รายการจากแท็บอื่น (หรือ dialog) แล้วกราฟอัปเดต (real-time)
- [ ] `tsc --noEmit` ผ่าน

---

## Phase 2d — Paotang Quota (query เฉพาะ)

**Branch:** `perf/phase-2d-paotang`  
**ขึ้นกับ:** Phase 0 types

### Ownership

| แก้ได้ | ห้ามแก้ |
|--------|---------|
| `src/hooks/use-paotang-usage.ts` (**ใหม่**) | analytics page |
| `src/components/transactions/transaction-form.tsx` | dashboard page |

### เป้าหมาย

เลิกพึ่ง `existingTransactions` ทั้งก้อน — `getPaotangUsageFromTransactions` ใน `src/lib/transaction-payment.ts` ต้องการแค่ Paotang tx ในเดือน/วันที่เกี่ยวข้อง

### Hook

```typescript
export function usePaotangUsage(options: {
  forDate: Date;
  quotaOwner: string;
  excludeTxId?: string;
}): PaotangQuotaUsage
```

### Query

```typescript
query(
  collection(db, 'transactions'),
  where('userId', '==', uid),
  where('paymentMethod', '==', 'paotang'),
  where('date', '>=', startOfMonth(forDate)),
  where('date', '<=', endOfMonth(forDate)), // หรือ end of day สำหรับ daily cap
  orderBy('date', 'desc')
)
```

**Index ต้องการ:** `userId + paymentMethod + date`

### แก้ `transaction-form.tsx`

- ลบ prop `existingTransactions` (breaking) **หรือ** ทำให้ optional แล้วใช้ `usePaotangUsage` แทน
- อัปเดต call sites ใน Phase INTEGRATION ถ้ายังไม่แก้ครบ

### Acceptance criteria

- [ ] ฟอร์ม Paotang คำนวณ quota ถูกต้อง
- [ ] ไม่ต้องโหลด transactions ทั้งหมดเพื่อเปิดฟอร์ม
- [ ] `tsc --noEmit` ผ่าน

---

## Phase 3 — Trip Data Consolidation

**Branch:** `perf/phase-3-trips`  
**ขึ้นกับ:** Phase 1 `trips-context` (แนะนำ)

### Ownership

| แก้ได้ | ห้ามแก้ |
|--------|---------|
| `src/providers/trips-data-context.tsx` (**ใหม่**) | `use-windowed-*.ts` |
| `src/hooks/use-all-trip-expenses.ts` | analytics |
| `src/hooks/use-trip-debts.ts` | |
| `src/app/(dashboard)/trips/page.tsx` | |
| `src/app/(dashboard)/page.tsx` | (เฉพาะส่วน tripDebts — ประสานกับ Phase 2a) |

### เป้าหมาย

1. รวม listener ซ้ำ: `useAllTripExpenses` + `useTripDebts` + inline listeners ใน `trips/page.tsx`
2. แก้ memory leak ใน `use-all-trip-expenses.ts` (unsubscribe ภายใน `onSnapshot` callback ไม่ถูก cleanup)

### `TripsDataProvider`

```typescript
interface TripsDataContextValue {
  trips: Trip[];
  tripExpenses: TripExpense[];
  tripSettlements: TripSettlement[];
  legacyTripTransactions: Transaction[];
  loading: boolean;
  // computed
  tripDebts: TripDebtSummary[];
}
```

- 1 listener `trips`
- N listeners `trip_expenses` / `trip_settlements` / `transactions` แบบ chunk (reuse logic จาก `use-trip-debts.ts`)
- expose ให้ Dashboard, Trips page, Transactions (ถ้าต้องการ trip merge)

### ลบ inline listeners

ใน `trips/page.tsx` บรรทัด ~546–588: ลบ `useEffect` ที่ subscribe `trip_expenses` / `trip_settlements` เอง → ใช้ context

### Acceptance criteria

- [ ] Trips page ทำงานเหมือนเดิม
- [ ] ไม่มี duplicate trip_expenses listeners
- [ ] Dashboard `useTripDebts` เปลี่ยนเป็น `useTripsData()` หรือ equivalent
- [ ] `tsc --noEmit` ผ่าน

---

## Phase INTEGRATION — หลัง merge ทุก branch

**Branch:** `perf/integration`  
**Agent เดียว** แนะนำ

### Checklist

- [ ] แก้ import ทุกหน้าที่ยังใช้ `useTransactions()` แบบเต็มก้อน
- [ ] ลบ `existingTransactions={transactions}` ทุก call site → ใช้ `usePaotangUsage` ใน form
- [ ] `FinanceDataProvider` + windowed hooks ไม่ subscribe ซ้ำ
- [ ] Dashboard ใช้ `useDashboardData` ไม่ใช่ `useTransactions` + `useAllTripExpenses` แยก
- [ ] Transactions ใช้ `useWindowedTransactions`
- [ ] Analytics ใช้ `useAnalyticsData`
- [ ] รัน `npx tsc --noEmit`
- [ ] ทดสอบ manual ตามด้านล่าง

### ไฟล์ call sites ที่ต้องตรวจ (`existingTransactions`)

```
src/app/(dashboard)/page.tsx
src/components/quick-add-context.tsx
src/app/(dashboard)/trips/[tripId]/page.tsx
src/app/(dashboard)/trips/page.tsx
src/components/transactions/transaction-detail-dialog.tsx
src/app/(dashboard)/transactions/page.tsx
src/app/(dashboard)/debts/page.tsx
src/components/transactions/transaction-form.tsx
```

---

## Firestore Indexes (`firestore.indexes.json`)

สร้าง/อัปเดตใน Phase 0:

```json
{
  "indexes": [
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "transactions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "userId", "order": "ASCENDING" },
        { "fieldPath": "paymentMethod", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "trip_expenses",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "tripId", "order": "ASCENDING" },
        { "fieldPath": "date", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

อัปเดต `firebase.json` ให้ชี้ `firestore.indexes.json` ถ้ายังไม่มี

Deploy: `npx firebase deploy --only firestore:indexes`

---

## Ownership Matrix (สรุป — ห้ามชน)

| ไฟล์ | Phase |
|------|-------|
| `src/lib/firestore-query/*` | 0 |
| `firestore.indexes.json` | 0 |
| `src/providers/finance-data-provider.tsx` | 1 |
| `src/providers/*-context.tsx` (ยกเว้น trips-data) | 1 |
| `src/hooks/use-*-context.ts` | 1 |
| `src/app/(dashboard)/layout.tsx` | 1 |
| `src/components/quick-add-context.tsx` | 1 |
| `src/hooks/use-dashboard-data.ts` | 2a |
| `src/app/(dashboard)/page.tsx` | 2a (+ integration) |
| `src/hooks/use-windowed-transactions.ts` | 2b |
| `src/hooks/use-windowed-trip-expenses.ts` | 2b |
| `src/app/(dashboard)/transactions/page.tsx` | 2b |
| `src/hooks/use-analytics-data.ts` | 2c |
| `src/app/(dashboard)/analytics/page.tsx` | 2c |
| `src/hooks/use-paotang-usage.ts` | 2d |
| `src/components/transactions/transaction-form.tsx` | 2d |
| `src/providers/trips-data-context.tsx` | 3 |
| `src/hooks/use-all-trip-expenses.ts` | 3 |
| `src/hooks/use-trip-debts.ts` | 3 |
| `src/app/(dashboard)/trips/page.tsx` | 3 |

---

## Manual Test Checklist

### Transactions (7 วัน)
- [ ] เปิดหน้า — เห็นเฉพาะ ~7 วันล่าสุด
- [ ] กดโหลดเพิ่ม — เห็นวันเก่าขึ้น
- [ ] Add รายการวันนี้ — ปรากฏทันที
- [ ] Edit รายการ — อัปเดตทันที
- [ ] กลุ่มวัน (DateGroupDivider) ถูกต้อง

### Dashboard
- [ ] สถิติเดือนนี้ถูกต้อง
- [ ] กราฟ 6 เดือนแสดง
- [ ] โหลดข้อมูลเก่ากว่า — กราฟขยาย

### Analytics
- [ ] เปลี่ยน range — ข้อมูลเปลี่ยน
- [ ] แก้รายการ — กราฟอัปเดต real-time

### Paotang
- [ ] สร้างรายการ Paotang — quota แสดงถูก
- [ ] แก้วันที่ — quota คำนวณใหม่

### Trips
- [ ] หน้า Trips — ยอด/รายการถูกต้อง
- [ ] ไม่ error จาก listener ซ้ำ

---

## Copy-Paste Prompts สำหรับ AI แต่ละตัว

### Agent Phase 0
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 0
สร้างไฟล์ใน src/lib/firestore-query/ และ firestore.indexes.json เท่านั้น
ห้ามแก้ hook หรือ page เดิม
รัน npx tsc --noEmit ก่อนจบ
```

### Agent Phase 1
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 1
สร้าง FinanceDataProvider และ context hooks
แก้เฉพาะไฟล์ใน ownership matrix Phase 1
ห้ามเพิ่ม date filter
```

### Agent Phase 2a
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 2a Dashboard
ใช้ date-windows จาก Phase 0
โหลดเริ่ม 6 เดือน lazy load เก่ากว่าเมื่อ user เลื่อนดูกราฟ
```

### Agent Phase 2b
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 2b
Transactions โหลดทีละ 7 วัน onSnapshot real-time
ปุ่มหรือ infinite scroll โหลด 7 วันก่อนหน้า
```

### Agent Phase 2c
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 2c Analytics
onSnapshot real-time query ตาม range dropdown
```

### Agent Phase 2d
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 2d Paotang
สร้าง usePaotangUsage แทน existingTransactions ใน transaction-form
```

### Agent Phase 3
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำเฉพาะ Phase 3 Trips
รวม trip listeners แก้ leak ใน use-all-trip-expenses
```

### Agent Integration
```
อ่าน docs/PERFORMANCE_OPTIMIZATION_PARALLEL.md ทำ Phase INTEGRATION
merge ทุก phase แก้ call sites และทดสอบตาม checklist
```

---

## หมายเหตุสำหรับผู้ประสานงาน

1. **Phase 0 ควร merge ก่อน** — phase อื่น import `date-windows` ได้
2. Phase 1 กับ 2a–2d ทำคู่ขนานได้ถ้าแตะคนละไฟล์
3. Phase 2b กับ 2d ชนกันที่ `transaction-form.tsx` — **ให้ 2d ทำ form, 2b แก้แค่ transactions/page.tsx** แล้วค่อย integrate
4. Dashboard (2a) กับ Phase 3 ชนที่ `page.tsx` — แบ่ง: 2a แก้ส่วน transactions/charts, Phase 3 แก้ส่วน tripDebts เท่านั้น หรือรอ integration
5. หลัง deploy indexes รอ Firebase สร้าง index เสร็จ (อาจใช้เวลา minutes) ก่อน QA เต็มรูปแบบ
