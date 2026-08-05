'use client'

import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { OptionalNoteField } from '@/components/shared/optional-note-field'
import { ImmichAttachmentsField } from '@/components/shared/immich-attachments-field'
import { cn } from '@/lib/utils'
import {
  TransactionSplitSection,
  validateTransactionSplit,
} from '@/components/transactions/transaction-split-section'
import { TransactionSplitMode } from '@/lib/transaction-split'
import { TaxCategoryId, TripExpense, TripExpensePayer, TripExpenseShare, TripCurrency } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import {
  getCountryConfig, getDefaultTaxCategory, type TaxMode,
} from '@/lib/tax/countries'
import { calculateLineTax, roundMoney } from '@/lib/tax/calculate'
import {
  formatCurrencySymbol,
  formatHomeConversion,
  formatTripDate,
  formatTripTime,
  getTripTimeZone,
  parseTripLocalDateTime,
} from '@/lib/trip-currency'

export interface TripFormDefaults {
  countryCode?: string | null
  tripCurrency?: TripCurrency
  homeCurrency?: TripCurrency
  exchangeRate?: number
}

interface Member {
  key: string
  displayName: string
}

interface TripExpenseFormV2Props {
  tripMembers: Member[]
  myUserId: string
  tripDefaults?: TripFormDefaults
  initialData?: TripExpense | null
  /** @deprecated use immich state from attachments; kept for compatibility */
  immichAssetId?: string | null
  /** Trip id for Immich upload auth/membership checks (not album routing) */
  tripId?: string
  pendingImmichAssetIds?: string[]
  onSubmit: (data: Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId'>) => Promise<void>
  onCancel: () => void
}

type SplitMode = TransactionSplitMode | 'item'

const categories = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
]

interface ReceiptItemInput {
  name: string
  category: string
  price: string
  tax: string
  taxCategoryId: TaxCategoryId
  splitWith: string[]
}

function inferTaxCategory(
  countryCode: string | null | undefined,
  category: string,
  saved?: TaxCategoryId
): TaxCategoryId {
  if (saved) return saved
  if (countryCode === 'JP') {
    return category === 'Food & Dining' ? 'food' : 'goods'
  }
  return getDefaultTaxCategory(countryCode || 'TH')
}

function emptyReceiptItem(
  tripMembers: Member[],
  countryCode?: string | null
): ReceiptItemInput {
  return {
    name: '',
    category: 'Food & Dining',
    price: '',
    tax: '',
    taxCategoryId: inferTaxCategory(countryCode, 'Food & Dining'),
    splitWith: tripMembers.map(m => m.key),
  }
}

export function TripExpenseFormV2({
  tripMembers,
  myUserId,
  tripDefaults,
  initialData,
  immichAssetId,
  tripId,
  pendingImmichAssetIds,
  onSubmit,
  onCancel,
}: TripExpenseFormV2Props) {
  const countryCode = tripDefaults?.countryCode ?? null
  const countryConfig = getCountryConfig(countryCode)
  const hasAutoTax = !!countryConfig
  const defaultTaxMode: TaxMode = countryConfig?.defaultTaxMode
    ?? (initialData?.taxMode as TaxMode)
    ?? 'exclusive'
  const defaultCurrency = initialData?.currency || tripDefaults?.tripCurrency || 'THB'
  const [description, setDescription] = React.useState(initialData?.description || '')
  const [totalAmount, setTotalAmount] = React.useState(initialData ? String(initialData.totalAmount) : '')
  const [subtotal, setSubtotal] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.baseAmount ? String(initialData.baseAmount) : '')
  const [tax, setTax] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.taxAmount ? String(initialData.taxAmount) : '')
  const [discount, setDiscount] = React.useState(
    initialData?.discount ? String(initialData.discount) : ''
  )
  const [category, setCategory] = React.useState(initialData?.category || '')
  const [date, setDate] = React.useState(
    initialData?.date?.seconds
      ? formatTripDate(new Date(initialData.date.seconds * 1000), getTripTimeZone(countryCode, initialData?.currency || defaultCurrency))
      : formatTripDate(new Date(), getTripTimeZone(countryCode, defaultCurrency))
  )
  const [time, setTime] = React.useState(
    initialData?.date?.seconds
      ? formatTripTime(new Date(initialData.date.seconds * 1000), getTripTimeZone(countryCode, initialData?.currency || defaultCurrency))
      : formatTripTime(new Date(), getTripTimeZone(countryCode, defaultCurrency))
  )
  const [note, setNote] = React.useState(initialData?.note || '')

  const [splitEnabled, setSplitEnabled] = React.useState(() => {
    if (!initialData) return false
    if (initialData.splitMode === 'item') return true
    if (initialData.splitMode && initialData.splitMode !== 'solo') return true
    if ((initialData.payers?.length ?? 0) > 1) return true
    if ((initialData.shares?.length ?? 0) > 1) return true
    return false
  })
  const [splitData, setSplitData] = React.useState<{
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: TransactionSplitMode
  } | null>(() => {
    if (!initialData?.payers?.length) return null
    return {
      payers: initialData.payers,
      shares: initialData.shares || [],
      splitMode: (initialData.splitMode === 'item' ? 'equal' : initialData.splitMode as TransactionSplitMode) || 'equal',
    }
  })
  const [useItemSplit, setUseItemSplit] = React.useState(
    () => initialData?.splitMode === 'item'
  )

  const [inputMode, setInputMode] = React.useState<'standard' | 'receipt'>(
    initialData?.items && initialData.items.length > 0 ? 'receipt' : 'standard'
  )

  const [receiptItems, setReceiptItems] = React.useState<ReceiptItemInput[]>(
    initialData?.items?.map(item => ({
      name: item.name,
      category: item.category,
      price: String(
        hasAutoTax && ((initialData?.taxMode || defaultTaxMode) === 'inclusive')
          ? item.price + (item.tax || 0)
          : item.price
      ),
      tax: String(item.tax),
      taxCategoryId: inferTaxCategory(countryCode, item.category, item.taxCategoryId),
      splitWith: item.splitWith || tripMembers.map(m => m.key),
    })) || [emptyReceiptItem(tripMembers, countryCode)]
  )

  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>(() =>
    collectImmichAssetIds({
      immichAssetId: initialData?.immichAssetId ?? immichAssetId,
      immichAssetIds: initialData?.immichAssetIds,
    })
  )

  React.useEffect(() => {
    setAttachmentIds(
      collectImmichAssetIds({
        immichAssetId: initialData?.immichAssetId ?? immichAssetId,
        immichAssetIds: initialData?.immichAssetIds,
      })
    )
  }, [initialData?.id, immichAssetId])

  React.useEffect(() => {
    if (pendingImmichAssetIds?.length) {
      setAttachmentIds((prev) => [...new Set([...prev, ...pendingImmichAssetIds])])
    }
  }, [pendingImmichAssetIds])
  const [currency, setCurrency] = React.useState<TripCurrency>(defaultCurrency)
  const tripTimeZone = getTripTimeZone(countryCode, currency)
  const tripTimeZoneLabel = tripTimeZone ? tripTimeZone.split('/').pop()?.replace('_', ' ') : 'Local'
  const [receiptTaxMode, setReceiptTaxMode] = React.useState<TaxMode>(
    (initialData?.taxMode as TaxMode) || defaultTaxMode
  )
  const [receiptTax, setReceiptTax] = React.useState(
    initialData?.taxAmount 
      ? String(initialData.taxAmount) 
      : (initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0) || 0) > 0
        ? String(initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0))
        : ''
  )

  const curSymbol = formatCurrencySymbol(currency)
  const tripForConversion = tripDefaults ? {
    tripCurrency: tripDefaults.tripCurrency,
    homeCurrency: tripDefaults.homeCurrency,
    exchangeRate: tripDefaults.exchangeRate,
  } : null
  const homeHint = (amount: number) => formatHomeConversion(amount, currency, tripForConversion)

  const calcReceiptLine = (rawVal: number, taxCategoryId: TaxCategoryId) => {
    if (hasAutoTax && countryCode) {
      const calc = calculateLineTax(rawVal, taxCategoryId, countryCode, receiptTaxMode)
      return { p: calc.base, t: calc.tax, itemTotal: calc.total, rate: calc.rate }
    }
    return null
  }

  // --- Real-time Receipt calculations ---
  const isReceiptActive = inputMode === 'receipt' && receiptItems.some(item => (parseFloat(item.price) || 0) > 0)

  let totalBaseAmount = 0
  let totalTaxAmount = hasAutoTax ? 0 : (parseFloat(receiptTax) || 0)
  let totalReceiptAmount = 0

  const lineAmounts = receiptItems.map(item => {
    const rawVal = parseFloat(item.price) || 0
    const auto = calcReceiptLine(rawVal, item.taxCategoryId)
    if (auto) return auto

    let p = 0
    let t = 0
    let itemTotal = 0
    if (receiptTaxMode === 'exclusive') {
      p = rawVal
      itemTotal = p
    } else {
      itemTotal = rawVal
      p = itemTotal
    }
    return { p, t, itemTotal, rate: 0 }
  })

  if (isReceiptActive) {
    if (hasAutoTax) {
      lineAmounts.forEach(l => {
        totalBaseAmount += l.p
        totalTaxAmount += l.t
        totalReceiptAmount += l.itemTotal
      })
      totalBaseAmount = roundMoney(totalBaseAmount)
      totalTaxAmount = roundMoney(totalTaxAmount)
      totalReceiptAmount = roundMoney(totalReceiptAmount)
    } else if (receiptTaxMode === 'exclusive') {
      receiptItems.forEach(item => {
        totalBaseAmount += parseFloat(item.price) || 0
      })
      totalReceiptAmount = totalBaseAmount + totalTaxAmount
    } else {
      receiptItems.forEach(item => {
        totalReceiptAmount += parseFloat(item.price) || 0
      })
      totalBaseAmount = Math.max(0, totalReceiptAmount - totalTaxAmount)
      lineAmounts.forEach((l, idx) => {
        const rawVal = parseFloat(receiptItems[idx].price) || 0
        const itemTotal = rawVal
        const t = totalReceiptAmount > 0 ? (itemTotal / totalReceiptAmount) * totalTaxAmount : 0
        l.t = t
        l.p = Math.max(0, itemTotal - t)
        l.itemTotal = itemTotal
      })
    }
  }

  const itemShares: Record<string, number> = {}
  tripMembers.forEach(m => { itemShares[m.key] = 0 })

  receiptItems.forEach((item, idx) => {
    const { itemTotal } = lineAmounts[idx]
    if (!hasAutoTax && isReceiptActive && receiptTaxMode === 'exclusive') {
      const rawVal = parseFloat(item.price) || 0
      const p = rawVal
      const t = totalBaseAmount > 0 ? (p / totalBaseAmount) * totalTaxAmount : 0
      lineAmounts[idx] = { p, t, itemTotal: p + t, rate: 0 }
    }

    const total = lineAmounts[idx].itemTotal
    if (total > 0 && item.splitWith.length > 0) {
      const share = total / item.splitWith.length
      item.splitWith.forEach(memberKey => {
        if (itemShares[memberKey] !== undefined) {
          itemShares[memberKey] += share
        }
      })
    }
  })

  const discountAmount = Math.max(0, parseFloat(discount) || 0)
  const receiptGross = totalReceiptAmount
  const receiptNet = Math.max(0, roundMoney(receiptGross - discountAmount))
  const manualGross = parseFloat(totalAmount) || 0
  // Standard: totalAmount field is kept as net when auto-calc'd from sub+tax−discount
  const total = isReceiptActive ? receiptNet : manualGross

  // Scale item shares when a receipt-level discount applies
  if (isReceiptActive && discountAmount > 0 && receiptGross > 0) {
    const scale = receiptNet / receiptGross
    for (const key of Object.keys(itemShares)) {
      itemShares[key] = roundMoney(itemShares[key] * scale)
    }
  }

  const recalcStandardTotal = (subVal: string, taxVal: string, discVal: string) => {
    const sub = parseFloat(subVal) || 0
    const tx = parseFloat(taxVal) || 0
    const disc = Math.max(0, parseFloat(discVal) || 0)
    if (sub > 0 || tx > 0) {
      setTotalAmount(Math.max(0, sub + tx - disc).toString())
    }
  }

  const splitMembers = React.useMemo(
    () => tripMembers.map((m) => ({ personId: m.key, displayName: m.displayName })),
    [tripMembers]
  )

  const handleSplitChange = React.useCallback(
    (data: { payers: TripExpensePayer[]; shares: TripExpenseShare[]; splitMode: TransactionSplitMode }) => {
      setSplitData(data)
    },
    []
  )

  // --- Build final payers/shares for submission ---
  const buildPayersShares = (): {
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: SplitMode
  } | null => {
    const errs: string[] = []

    if (!description.trim()) errs.push('กรุณากรอกรายละเอียด')
    if (!total || total <= 0) errs.push('กรุณากรอกจำนวนเงิน')
    if (!category) errs.push('กรุณาเลือกหมวดหมู่')
    const grossForDiscount = isReceiptActive ? receiptGross : (
      (parseFloat(subtotal) || 0) > 0 || (parseFloat(tax) || 0) > 0
        ? (parseFloat(subtotal) || 0) + (parseFloat(tax) || 0)
        : total + discountAmount
    )
    if (discountAmount > 0 && grossForDiscount > 0 && discountAmount > grossForDiscount) {
      errs.push('ส่วนลดต้องไม่เกินยอดรวม')
    }

    let finalPayers: TripExpensePayer[]
    let finalShares: TripExpenseShare[]
    let finalSplitMode: SplitMode = 'solo'

    if (!splitEnabled) {
      const me = tripMembers.find((m) => m.key === myUserId)
      finalPayers = [{
        userId: myUserId,
        displayName: me?.displayName || 'Me',
        amount: total,
      }]
      finalShares = [...finalPayers]
      finalSplitMode = 'solo'
    } else if (useItemSplit && inputMode === 'receipt') {
      if (!splitData?.payers?.length) {
        errs.push('กรุณาระบุผู้จ่าย')
      }
      if (!isReceiptActive) {
        errs.push('กรุณากรอกรายการสินค้าเพื่อใช้โหมดแบ่งจ่ายรายชิ้น')
      }
      finalPayers = splitData?.payers || []
      finalShares = tripMembers.map((m) => ({
        userId: m.key,
        displayName: m.displayName,
        amount: parseFloat((itemShares[m.key] || 0).toFixed(2)),
      }))
      finalSplitMode = 'item'
    } else if (splitData) {
      const splitErrs = validateTransactionSplit(total, splitData.payers, splitData.shares)
      errs.push(...splitErrs)
      finalPayers = splitData.payers
      finalShares = splitData.shares
      finalSplitMode = splitData.splitMode
    } else {
      errs.push('กรุณาตั้งค่าการแบ่งจ่าย')
      finalPayers = []
      finalShares = []
    }

    setErrors(errs)
    if (errs.length > 0) return null
    return { payers: finalPayers, shares: finalShares, splitMode: finalSplitMode }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = buildPayersShares()
    if (!result) return
    setSubmitting(true)
    try {
      const payload: any = {
        description,
        totalAmount: total,
        category: category,
        date: Timestamp.fromDate(parseTripLocalDateTime(date, time, tripTimeZone)),
        note: note.trim() || undefined,
        splitMode: result.splitMode,
        payers: result.payers,
        shares: result.shares,
        currency,
        source: initialData?.source || 'manual',
      }

      if (discountAmount > 0) {
        payload.discount = discountAmount
      } else {
        // 0 signals clear on update; omitted on create via stripUndefined... keep explicit 0 for update path
        payload.discount = 0
      }

      if (isReceiptActive) {
        payload.items = receiptItems.map((item, idx) => {
          const { p, t, rate } = lineAmounts[idx]
          return {
            name: item.name || 'Item',
            category: item.category,
            price: roundMoney(p),
            tax: roundMoney(t),
            splitWith: item.splitWith,
            ...(hasAutoTax ? {
              taxCategoryId: item.taxCategoryId,
              taxRate: rate,
            } : {}),
          }
        })
        payload.baseAmount = totalBaseAmount
        payload.taxAmount = totalTaxAmount
        payload.taxMode = receiptTaxMode
      } else {
        payload.baseAmount = parseFloat(subtotal) || total || 0
        payload.taxAmount = parseFloat(tax) || 0
      }

      if (attachmentIds.length) {
        payload.immichAssetIds = [...new Set(attachmentIds)]
      } else {
        payload.immichAssetIds = undefined
        payload.immichAssetId = null
      }

      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-2">
      <ImmichAttachmentsField
        value={attachmentIds}
        onChange={setAttachmentIds}
        tripId={tripId}
        deliveryKey={
          initialData?.id
            ? `attachments:trip-expense:${initialData.id}`
            : `attachments:trip-expense:new:${tripId ?? 'unknown'}`
        }
      />
      {/* Input Mode Selector */}
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist" aria-label="Expense input mode">
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'standard'}
          onClick={() => {
            setInputMode('standard')
            setUseItemSplit(false)
          }}
          className={cn(
            'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors duration-200',
            inputMode === 'standard' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Standard
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={inputMode === 'receipt'}
          onClick={() => {
            setInputMode('receipt')
            setUseItemSplit(true)
          }}
          className={cn(
            'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors duration-200',
            inputMode === 'receipt' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Receipt
        </button>
      </div>

      {/* Currency Selector */}
      <div className="space-y-1.5">
        <Label>สกุลเงิน (Currency)</Label>
        {tripDefaults?.tripCurrency && (
          <p className="text-xs text-muted-foreground">
            ค่าเริ่มต้นจากทริป: {formatCurrencySymbol(tripDefaults.tripCurrency)} ({tripDefaults.tripCurrency})
          </p>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={currency === 'THB' ? 'default' : 'outline'}
            className="flex-1 text-xs gap-1 h-9 font-medium"
            onClick={() => setCurrency('THB')}
          >
            ฿ บาท (THB)
          </Button>
          <Button
            type="button"
            variant={currency === 'JPY' ? 'default' : 'outline'}
            className="flex-1 text-xs gap-1 h-9 font-medium"
            onClick={() => setCurrency('JPY')}
          >
            ¥ เยน (JPY)
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label>รายละเอียด</Label>
        <Textarea placeholder="เช่น อาหารมื้อเย็น, ค่าแท็กซี่..." className="resize-none"
          value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {/* Amount + Category + Date */}
      {inputMode === 'standard' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 border p-3 rounded-lg bg-muted/20 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">ราคาสินค้า ({curSymbol})</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={subtotal}
                onChange={e => {
                  const val = e.target.value
                  setSubtotal(val)
                  recalcStandardTotal(val, tax, discount)
                }}
                className="h-9 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ภาษี ({curSymbol})</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={tax}
                onChange={e => {
                  const val = e.target.value
                  setTax(val)
                  recalcStandardTotal(subtotal, val, discount)
                }}
                className="h-9 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">ส่วนลด ({curSymbol})</Label>
              <Input 
                type="number" 
                step="0.01"
                min="0"
                placeholder="0.00"
                value={discount}
                onChange={e => {
                  const val = e.target.value
                  setDiscount(val)
                  recalcStandardTotal(subtotal, tax, val)
                }}
                className="h-9 text-xs tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-primary">ยอดรวม ({curSymbol})</Label>
              <Input 
                type="number" 
                step="0.01" 
                placeholder="0.00"
                value={totalAmount}
                onChange={e => {
                  setTotalAmount(e.target.value)
                  setSubtotal('')
                  setTax('')
                }}
                className="h-9 text-xs font-semibold tabular-nums border-primary/40 focus-visible:ring-primary"
              />
            </div>
          </div>
          {discountAmount > 0 && manualGross > 0 && (
            <p className="text-[10px] text-muted-foreground tabular-nums px-1">
              ยอดก่อนหักส่วนลด {curSymbol}
              {(
                (parseFloat(subtotal) || 0) > 0 || (parseFloat(tax) || 0) > 0
                  ? (parseFloat(subtotal) || 0) + (parseFloat(tax) || 0)
                  : manualGross + discountAmount
              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}− ส่วนลด {curSymbol}
              {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {inputMode === 'receipt' && (
          <div className="space-y-1.5">
            <Label>ยอดรวม ({curSymbol})</Label>
            <Input type="number" step="0.01" placeholder="0.00"
              disabled={true}
              value={receiptNet.toFixed(2)} />
          </div>
        )}
        <div className={cn("space-y-1.5", inputMode === 'standard' && "col-span-2")}>
          <Label>หมวดหมู่</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="เลือก..." /></SelectTrigger>
            <SelectContent>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>วันที่</Label>
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>เวลา</Label>
            {tripTimeZone && (
              <span className="text-[11px] text-muted-foreground">{tripTimeZoneLabel}</span>
            )}
          </div>
          <Input type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>

      {/* Receipt Items (Only in Receipt Mode) */}
      {inputMode === 'receipt' && (
        <div className="space-y-4 border rounded-lg p-3 bg-muted/20 overflow-hidden">
          <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h4 className="text-xs font-semibold text-muted-foreground">Receipt items</h4>
              <div className="inline-flex w-full rounded-lg border p-0.5 bg-muted/60 text-[10px] select-none sm:w-auto">
                <button
                  type="button"
                  onClick={() => setReceiptTaxMode('exclusive')}
                  className={cn(
                    "flex-1 px-2 py-0.5 rounded-md font-medium transition-all sm:flex-none",
                    receiptTaxMode === 'exclusive'
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ไม่รวมภาษี
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptTaxMode('inclusive')}
                  className={cn(
                    "flex-1 px-2 py-0.5 rounded-md font-medium transition-all sm:flex-none",
                    receiptTaxMode === 'inclusive'
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  รวมภาษีแล้ว
                </button>
              </div>
            </div>
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReceiptItems([...receiptItems, emptyReceiptItem(tripMembers, countryCode)])}
              className="h-7 text-xs gap-1"
            >
              <Plus className="size-3" /> Add Product
            </Button>
          </div>

          <div className="space-y-3">
            {receiptItems.map((item, idx) => {
              const { itemTotal, t } = lineAmounts[idx]
              const taxRules = countryConfig?.taxRules ?? []

              return (
                <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 pt-2 space-y-2">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
                    <Input
                      placeholder="Product Name"
                      className="h-9 text-xs"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx].name = e.target.value
                        setReceiptItems(next)
                      }}
                    />

                    <Select
                      value={item.category}
                      onValueChange={val => {
                        const next = [...receiptItems]
                        next[idx].category = val
                        if (hasAutoTax) {
                          next[idx].taxCategoryId = inferTaxCategory(countryCode, val, undefined)
                        }
                        setReceiptItems(next)
                      }}
                    >
                      <SelectTrigger className="h-9 w-full text-xs sm:w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">
                        {curSymbol}
                      </span>
                      <Input
                        type="number"
                        placeholder={receiptTaxMode === 'exclusive' ? "Excl. Tax" : "Incl. Tax"}
                        className="h-9 pl-6 pr-1 text-xs font-medium"
                        value={item.price}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx].price = e.target.value
                          setReceiptItems(next)
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasAutoTax && taxRules.length > 0 && (
                      <Select
                        value={item.taxCategoryId}
                        onValueChange={val => {
                          const next = [...receiptItems]
                          next[idx].taxCategoryId = val as TaxCategoryId
                          setReceiptItems(next)
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-[10px] sm:w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taxRules.map(rule => (
                            <SelectItem key={rule.id} value={rule.id} className="text-xs">
                              {rule.labelTh}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      ={curSymbol}{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {hasAutoTax && t > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-muted-foreground/80">
                          (ภาษี {curSymbol}{t.toFixed(0)})
                        </span>
                      )}
                    </span>

                    <div className="flex flex-1 flex-wrap items-center gap-1 sm:justify-end">
                      <span className="text-[10px] text-muted-foreground">หาร:</span>
                      {tripMembers.map(m => {
                        const included = item.splitWith.includes(m.key)
                        const initials = m.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)
                        return (
                          <button
                            key={m.key}
                            type="button"
                            title={m.displayName}
                            onClick={() => {
                              const next = [...receiptItems]
                              const currentSplit = next[idx].splitWith
                              if (currentSplit.includes(m.key)) {
                                next[idx].splitWith = currentSplit.filter(k => k !== m.key)
                              } else {
                                next[idx].splitWith = [...currentSplit, m.key]
                              }
                              setReceiptItems(next)
                            }}
                            className={cn(
                              "size-6 rounded-full text-[9px] font-bold border transition-all shrink-0 flex items-center justify-center",
                              included
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-muted-foreground/30 hover:bg-muted"
                            )}
                          >
                            {initials}
                          </button>
                        )
                      })}
                    </div>

                    {receiptItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setReceiptItems(receiptItems.filter((_, i) => i !== idx))}
                      >
                        <Minus className="size-4" />
                      </Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReceiptItems([...receiptItems, emptyReceiptItem(tripMembers, countryCode)])}
            className="h-8 w-full gap-1 border-dashed text-xs"
          >
            <Plus className="size-3" /> เพิ่มรายการ
          </Button>

          {/* Receipt Level Summary & Tax Breakdown */}
          <div className="grid grid-cols-1 gap-3 border-t pt-4 mt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ราคาสินค้ารวม (Subtotal)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {curSymbol}
                </span>
                <Input
                  type="number"
                  disabled
                  className="pl-6 h-9 text-xs bg-muted/50 font-medium tabular-nums"
                  value={totalBaseAmount.toFixed(2)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-semibold text-primary">
                {hasAutoTax ? 'ภาษีรวม (คำนวณอัตโนมัติ)' : 'ภาษีรวมทั้งใบเสร็จ (Tax)'}
              </Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {curSymbol}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  disabled={hasAutoTax}
                  className="pl-6 h-9 text-xs font-semibold border-primary/40 focus-visible:ring-primary disabled:opacity-80"
                  value={hasAutoTax ? totalTaxAmount.toFixed(2) : receiptTax}
                  onChange={e => !hasAutoTax && setReceiptTax(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ส่วนลด (Discount)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {curSymbol}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  className="pl-6 h-9 text-xs font-medium tabular-nums"
                  value={discount}
                  onChange={e => setDiscount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-bold text-foreground">ยอดรวมสุทธิ (Total)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {curSymbol}
                </span>
                <Input
                  type="number"
                  disabled
                  className="pl-6 h-9 text-xs bg-muted/30 font-bold tabular-nums text-foreground border-muted-foreground/30"
                  value={receiptNet.toFixed(2)}
                />
              </div>
              {discountAmount > 0 && receiptGross > 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums">
                  รวม {curSymbol}{receiptGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}− ส่วนลด {curSymbol}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              {homeHint(receiptNet) && (
                <p className="text-[10px] text-muted-foreground">≈ {homeHint(receiptNet)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split payment — same UX as Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>แบ่งค่าใช้จ่ายกับเพื่อน</Label>
          <button
            type="button"
            onClick={() => {
              const next = !splitEnabled
              setSplitEnabled(next)
              if (!next) setSplitData(null)
            }}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
              splitEnabled
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border hover:border-primary/50'
            )}
          >
            {splitEnabled ? 'เปิดอยู่' : 'ปิด'}
          </button>
        </div>

        {splitEnabled && inputMode === 'receipt' && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUseItemSplit(true)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all sm:min-w-[80px]',
                useItemSplit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              🧾 หารแยกสินค้า
            </button>
            <button
              type="button"
              onClick={() => setUseItemSplit(false)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all sm:min-w-[80px]',
                !useItemSplit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              ⚖️ หารแบบทั่วไป
            </button>
          </div>
        )}

        {splitEnabled && total > 0 && (
          <>
            <TransactionSplitSection
              total={total}
              members={splitMembers}
              currencySymbol={curSymbol}
              previewPersonId={myUserId}
              hideSplitOptions={useItemSplit && inputMode === 'receipt'}
              initialPayers={splitData?.payers ?? initialData?.payers}
              initialShares={useItemSplit ? undefined : (splitData?.shares ?? initialData?.shares)}
              initialSplitMode={useItemSplit ? 'equal' : (splitData?.splitMode ?? (initialData?.splitMode === 'item' ? 'equal' : initialData?.splitMode as TransactionSplitMode))}
              onChange={handleSplitChange}
            />
            {useItemSplit && inputMode === 'receipt' && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">สรุปการหารรายชิ้น:</p>
                <div className="space-y-1 bg-muted/30 p-2.5 rounded-lg text-xs text-muted-foreground">
                  {tripMembers.map(m => (
                    <div key={m.key} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate">{m.displayName}</span>
                      <span className="font-semibold tabular-nums text-foreground shrink-0">{curSymbol}{(itemShares[m.key] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
        {splitEnabled && total <= 0 && (
          <p className="text-xs text-muted-foreground">กรอกจำนวนเงินก่อนเพื่อตั้งค่าการแบ่งจ่าย</p>
        )}
      </div>

      {/* Note */}
      <OptionalNoteField value={note} onChange={setNote} />

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1">
          {errors.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
      </div>
    </form>
  )
}
