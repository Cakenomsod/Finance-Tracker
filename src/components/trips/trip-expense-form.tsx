'use client'

import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { toDateFromFirestore } from '@/lib/datetime'
import { categoryLabel } from '@/lib/default-categories'
import { useLocale } from '@/components/locale-provider'
import { MoneyInput } from '@/components/shared/money-input'
import type { LocalizedText } from '@/lib/i18n'

const TAX_RULE_LABELS: Record<string, Omit<LocalizedText, 'th'>> = {
  standard: { en: 'Standard (VAT 7%)', zh: '标准（增值税 7%）' },
  exempt: { en: 'Tax-exempt', zh: '免税' },
  food: { en: 'Food & drink (8%)', zh: '食品/饮料（8%）' },
  goods: { en: 'General goods (10%)', zh: '一般商品（10%）' },
}

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
  const { locale, p, t: tr } = useLocale()
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
  const initialDate = toDateFromFirestore(initialData?.date) ?? new Date()
  const [date, setDate] = React.useState(
    formatTripDate(initialDate, getTripTimeZone(countryCode, initialData?.currency || defaultCurrency))
  )
  const [time, setTime] = React.useState(
    formatTripTime(initialDate, getTripTimeZone(countryCode, initialData?.currency || defaultCurrency))
  )
  const [note, setNote] = React.useState(initialData?.note || '')

  const [splitEnabled, setSplitEnabled] = React.useState(() => {
    if (!initialData) return tripMembers.length > 1
    if (!initialData.id && !initialData.splitMode && !initialData.payers?.length) {
      return tripMembers.length > 1
    }
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
  const tripTimeZoneLabel = tripTimeZone
    ? tripTimeZone.split('/').pop()?.replace('_', ' ')
    : p({ th: 'เวลาท้องถิ่น', en: 'Local', zh: '本地时间' })
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
  const categoryOptions = React.useMemo(() => {
    if (category && !categories.includes(category)) {
      return [...categories, category]
    }
    return categories
  }, [category])
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
    const t = 0
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
    const splitWith = item.splitWith || []
    if (total > 0 && splitWith.length > 0) {
      const share = total / splitWith.length
      splitWith.forEach(memberKey => {
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

    if (!description.trim()) {
      errs.push(p({ th: 'กรุณากรอกรายละเอียด', en: 'Enter a description', zh: '请输入描述' }))
    }
    if (!total || total <= 0) {
      errs.push(p({ th: 'กรุณากรอกจำนวนเงิน', en: 'Enter an amount', zh: '请输入金额' }))
    }
    if (!category) {
      errs.push(p({ th: 'กรุณาเลือกหมวดหมู่', en: 'Pick a category', zh: '请选择类别' }))
    }
    const grossForDiscount = isReceiptActive ? receiptGross : (
      (parseFloat(subtotal) || 0) > 0 || (parseFloat(tax) || 0) > 0
        ? (parseFloat(subtotal) || 0) + (parseFloat(tax) || 0)
        : total + discountAmount
    )
    if (discountAmount > 0 && grossForDiscount > 0 && discountAmount > grossForDiscount) {
      errs.push(
        p({
          th: 'ส่วนลดต้องไม่เกินยอดรวม',
          en: "Discount can't exceed the total",
          zh: '折扣不能超过总额',
        })
      )
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
        errs.push(p({ th: 'กรุณาระบุผู้จ่าย', en: 'Pick who paid', zh: '请选择付款人' }))
      }
      if (!isReceiptActive) {
        errs.push(
          p({
            th: 'กรุณากรอกรายการสินค้าเพื่อใช้โหมดแบ่งจ่ายรายชิ้น',
            en: 'Add receipt items to split by item',
            zh: '请填写商品明细以按商品分摊',
          })
        )
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
      errs.push(p({ th: 'กรุณาตั้งค่าการแบ่งจ่าย', en: 'Set up the split', zh: '请设置分摊方式' }))
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
      <div
        className="flex gap-1 rounded-lg bg-muted p-1"
        role="tablist"
        aria-label={p({ th: 'รูปแบบการกรอก', en: 'Entry mode', zh: '录入方式' })}
      >
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
          {p({ th: 'ยอดเดียว', en: 'Single amount', zh: '单一金额' })}
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
          {p({ th: 'แยกตามใบเสร็จ', en: 'Itemized receipt', zh: '收据明细' })}
        </button>
      </div>

      {/* Currency Selector */}
      <div className="space-y-1.5">
        <p className="text-sm font-medium" id="trip-expense-currency-label">
          {p({ th: 'สกุลเงิน', en: 'Currency', zh: '货币' })}
        </p>
        {tripDefaults?.tripCurrency && (
          <p className="text-xs text-muted-foreground">
            {p({ th: 'ค่าเริ่มต้นจากทริป:', en: 'Trip default:', zh: '行程默认：' })}{' '}
            {formatCurrencySymbol(tripDefaults.tripCurrency)} ({tripDefaults.tripCurrency})
          </p>
        )}
        <div className="flex gap-2" role="group" aria-labelledby="trip-expense-currency-label">
          <Button
            type="button"
            aria-pressed={currency === 'THB'}
            variant={currency === 'THB' ? 'default' : 'outline'}
            className="flex-1 text-xs gap-1 h-9 font-medium"
            onClick={() => setCurrency('THB')}
          >
            ฿ {p({ th: 'บาท', en: 'Baht', zh: '泰铢' })} (THB)
          </Button>
          <Button
            type="button"
            aria-pressed={currency === 'JPY'}
            variant={currency === 'JPY' ? 'default' : 'outline'}
            className="flex-1 text-xs gap-1 h-9 font-medium"
            onClick={() => setCurrency('JPY')}
          >
            ¥ {p({ th: 'เยน', en: 'Yen', zh: '日元' })} (JPY)
          </Button>
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="trip-expense-description">
          {p({ th: 'รายละเอียด', en: 'Description', zh: '描述' })}
        </Label>
        <Textarea
          id="trip-expense-description"
          placeholder={p({
            th: 'เช่น อาหารมื้อเย็น, ค่าแท็กซี่...',
            en: 'e.g. Dinner, taxi…',
            zh: '例如：晚餐、打车…',
          })}
          className="resize-none"
          value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {/* Amount + Category + Date */}
      {inputMode === 'standard' && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-3 border p-3 rounded-lg bg-muted/20 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="trip-expense-subtotal" className="text-xs">
                {p({ th: 'ราคาสินค้า', en: 'Subtotal', zh: '商品价格' })} ({curSymbol})
              </Label>
              <Input
                id="trip-expense-subtotal"
                inputMode="decimal"
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
              <Label htmlFor="trip-expense-tax" className="text-xs">
                {p({ th: 'ภาษี', en: 'Tax', zh: '税费' })} ({curSymbol})
              </Label>
              <Input
                id="trip-expense-tax"
                inputMode="decimal"
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
              <Label htmlFor="trip-expense-discount" className="text-xs">
                {p({ th: 'ส่วนลด', en: 'Discount', zh: '折扣' })} ({curSymbol})
              </Label>
              <Input
                id="trip-expense-discount"
                inputMode="decimal"
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
              <Label htmlFor="trip-expense-total" className="text-xs font-semibold text-primary">
                {p({ th: 'ยอดรวม', en: 'Total', zh: '总额' })} ({curSymbol})
              </Label>
              <Input
                id="trip-expense-total"
                inputMode="decimal"
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
            <p className="text-xs text-muted-foreground tabular-nums px-1">
              {p({ th: 'ยอดก่อนหักส่วนลด', en: 'Before discount', zh: '折扣前' })} {curSymbol}
              {(
                (parseFloat(subtotal) || 0) > 0 || (parseFloat(tax) || 0) > 0
                  ? (parseFloat(subtotal) || 0) + (parseFloat(tax) || 0)
                  : manualGross + discountAmount
              ).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              {' '}− {p({ th: 'ส่วนลด', en: 'discount', zh: '折扣' })} {curSymbol}
              {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {inputMode === 'receipt' && (
          <div className="space-y-1.5">
            <Label htmlFor="trip-expense-receipt-total">
              {p({ th: 'ยอดรวม', en: 'Total', zh: '总额' })} ({curSymbol})
            </Label>
            <Input id="trip-expense-receipt-total" type="number" step="0.01" placeholder="0.00"
              disabled={true}
              value={receiptNet.toFixed(2)} />
          </div>
        )}
        <div className={cn("space-y-1.5", inputMode === 'standard' && "col-span-2")}>
          <Label htmlFor="trip-expense-category">
            {p({ th: 'หมวดหมู่', en: 'Category', zh: '类别' })}
          </Label>
          <Select value={category || undefined} onValueChange={setCategory}>
            <SelectTrigger id="trip-expense-category" className="w-full">
              <SelectValue placeholder={p({ th: 'เลือก...', en: 'Select…', zh: '请选择…' })} />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions.map(c => <SelectItem key={c} value={c}>{categoryLabel(c, locale)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="trip-expense-date">{p({ th: 'วันที่', en: 'Date', zh: '日期' })}</Label>
          <Input id="trip-expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="trip-expense-time">{p({ th: 'เวลา', en: 'Time', zh: '时间' })}</Label>
            {tripTimeZone && (
              <span className="text-xs text-muted-foreground">{tripTimeZoneLabel}</span>
            )}
          </div>
          <Input id="trip-expense-time" type="time" value={time} onChange={e => setTime(e.target.value)} />
        </div>
      </div>

      {/* Receipt Items (Only in Receipt Mode) */}
      {inputMode === 'receipt' && (
        <div className="space-y-4 border rounded-lg p-3 bg-muted/20 overflow-hidden">
          <div className="flex flex-col gap-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <h4 className="text-xs font-semibold text-muted-foreground">
                {p({ th: 'รายการในใบเสร็จ', en: 'Receipt items', zh: '收据明细' })}
              </h4>
              <div className="inline-flex w-full rounded-lg border p-0.5 bg-muted/60 text-xs select-none sm:w-auto">
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
                  {p({ th: 'ไม่รวมภาษี', en: 'Excl. tax', zh: '不含税' })}
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
                  {p({ th: 'รวมภาษีแล้ว', en: 'Incl. tax', zh: '已含税' })}
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
              <Plus className="size-3" /> {p({ th: 'เพิ่มสินค้า', en: 'Add item', zh: '添加商品' })}
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
                      placeholder={p({ th: 'ชื่อสินค้า', en: 'Item name', zh: '商品名称' })}
                      className="h-9 text-xs"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx].name = e.target.value
                        setReceiptItems(next)
                      }}
                    />

                    <Select
                      value={item.category || undefined}
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
                        {(item.category && !categories.includes(item.category)
                          ? [...categories, item.category]
                          : categories
                        ).map(c => (
                          <SelectItem key={c} value={c} className="text-xs">
                            {categoryLabel(c, locale)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <MoneyInput
                      currencySymbol={curSymbol}
                      wrapperClassName="sm:w-32"
                      placeholder={
                        receiptTaxMode === 'exclusive'
                          ? p({ th: 'ไม่รวมภาษี', en: 'Excl. tax', zh: '不含税' })
                          : p({ th: 'รวมภาษี', en: 'Incl. tax', zh: '含税' })
                      }
                      aria-label={p({ th: 'ราคา', en: 'Price', zh: '价格' })}
                      className="h-9 pr-1 text-base sm:text-xs font-medium"
                      value={item.price}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx].price = e.target.value
                        setReceiptItems(next)
                      }}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {hasAutoTax && taxRules.length > 0 && (
                      <Select
                        value={
                          taxRules.some((r) => r.id === item.taxCategoryId)
                            ? item.taxCategoryId
                            : taxRules[0]?.id
                        }
                        onValueChange={val => {
                          const next = [...receiptItems]
                          next[idx].taxCategoryId = val as TaxCategoryId
                          setReceiptItems(next)
                        }}
                      >
                        <SelectTrigger className="h-8 w-full text-xs sm:w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {taxRules.map(rule => (
                            <SelectItem key={rule.id} value={rule.id} className="text-xs">
                              {locale === 'th'
                                ? rule.labelTh
                                : TAX_RULE_LABELS[rule.id]
                                  ? p({ th: rule.labelTh, ...TAX_RULE_LABELS[rule.id] })
                                  : rule.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                      ={curSymbol}{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {hasAutoTax && t > 0 && (
                        <span className="ml-1 text-xs font-normal text-muted-foreground/80">
                          ({p({ th: 'ภาษี', en: 'tax', zh: '税' })} {curSymbol}{t.toFixed(0)})
                        </span>
                      )}
                    </span>

                    <div className="flex flex-1 flex-wrap items-center gap-1 sm:justify-end">
                      <span className="text-xs text-muted-foreground">
                        {p({ th: 'หาร:', en: 'Split:', zh: '分摊：' })}
                      </span>
                      {tripMembers.map(m => {
                        const included = (item.splitWith || []).includes(m.key)
                        const initials = m.displayName.split(' ').map((w) => w[0]).join('').toUpperCase().substring(0, 2)
                        return (
                          <button
                            key={m.key}
                            type="button"
                            title={m.displayName}
                            aria-label={m.displayName}
                            aria-pressed={included}
                            onClick={() => {
                              const next = [...receiptItems]
                              const currentSplit = next[idx].splitWith || []
                              if (currentSplit.includes(m.key)) {
                                next[idx].splitWith = currentSplit.filter(k => k !== m.key)
                              } else {
                                next[idx].splitWith = [...currentSplit, m.key]
                              }
                              setReceiptItems(next)
                            }}
                            className={cn(
                              "size-6 rounded-full text-xs font-bold border transition-all shrink-0 flex items-center justify-center",
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
                        aria-label={p({ th: 'ลบรายการ', en: 'Remove item', zh: '删除商品' })}
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
            <Plus className="size-3" /> {p({ th: 'เพิ่มรายการ', en: 'Add item', zh: '添加商品' })}
          </Button>

          {/* Receipt Level Summary & Tax Breakdown */}
          <div className="grid grid-cols-1 gap-3 border-t pt-4 mt-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="trip-receipt-subtotal" className="text-xs text-muted-foreground">
                {p({ th: 'ราคาสินค้ารวม', en: 'Items subtotal', zh: '商品合计' })}
              </Label>
              <MoneyInput
                id="trip-receipt-subtotal"
                currencySymbol={curSymbol}
                disabled
                className="h-9 text-xs bg-muted/50 font-medium"
                value={totalBaseAmount.toFixed(2)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-receipt-tax" className="text-xs text-muted-foreground font-semibold text-primary">
                {hasAutoTax
                  ? p({ th: 'ภาษีรวม (คำนวณอัตโนมัติ)', en: 'Total tax (auto)', zh: '税费合计（自动计算）' })
                  : p({ th: 'ภาษีรวมทั้งใบเสร็จ', en: 'Receipt tax', zh: '整张收据税费' })}
              </Label>
              <MoneyInput
                id="trip-receipt-tax"
                currencySymbol={curSymbol}
                step="0.01"
                placeholder="0.00"
                disabled={hasAutoTax}
                className="h-9 text-base sm:text-xs font-semibold border-primary/40 focus-visible:ring-primary disabled:opacity-80"
                value={hasAutoTax ? totalTaxAmount.toFixed(2) : receiptTax}
                onChange={e => !hasAutoTax && setReceiptTax(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-receipt-discount" className="text-xs text-muted-foreground">
                {p({ th: 'ส่วนลด', en: 'Discount', zh: '折扣' })}
              </Label>
              <MoneyInput
                id="trip-receipt-discount"
                currencySymbol={curSymbol}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="h-9 text-base sm:text-xs font-medium"
                value={discount}
                onChange={e => setDiscount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-receipt-net" className="text-xs text-muted-foreground font-bold text-foreground">
                {p({ th: 'ยอดรวมสุทธิ', en: 'Net total', zh: '实付总额' })}
              </Label>
              <MoneyInput
                id="trip-receipt-net"
                currencySymbol={curSymbol}
                disabled
                className="h-9 text-xs bg-muted/30 font-bold text-foreground border-muted-foreground/30"
                value={receiptNet.toFixed(2)}
              />
              {discountAmount > 0 && receiptGross > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums">
                  {p({ th: 'รวม', en: 'Gross', zh: '合计' })} {curSymbol}{receiptGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  {' '}− {p({ th: 'ส่วนลด', en: 'discount', zh: '折扣' })} {curSymbol}{discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              )}
              {homeHint(receiptNet) && (
                <p className="text-xs text-muted-foreground">≈ {homeHint(receiptNet)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Split payment — same UX as Transactions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <Label htmlFor="trip-expense-split">
              {p({ th: 'หารกับเพื่อนในทริป', en: 'Split with trip members', zh: '与行程成员分摊' })}
            </Label>
            <p className="text-xs text-muted-foreground">
              {splitEnabled
                ? p({
                    th: `หารกับ ${tripMembers.length} คนเป็นค่าเริ่มต้น — เปลี่ยนได้ด้านล่าง`,
                    en: `Split between ${tripMembers.length} people by default — change below`,
                    zh: `默认由 ${tripMembers.length} 人分摊——可在下方修改`,
                  })
                : p({
                    th: 'ปิดไว้ = คุณออกเองทั้งหมด',
                    en: 'Off — you pay the whole thing',
                    zh: '关闭 = 全部由你支付',
                  })}
            </p>
          </div>
          <Switch
            id="trip-expense-split"
            checked={splitEnabled}
            onCheckedChange={(next) => {
              setSplitEnabled(next)
              if (!next) setSplitData(null)
            }}
          />
        </div>

        {splitEnabled && inputMode === 'receipt' && (
          <div
            role="group"
            aria-label={p({ th: 'วิธีหารใบเสร็จ', en: 'How to split the receipt', zh: '收据分摊方式' })}
            className="grid grid-cols-2 gap-2"
          >
            <button
              type="button"
              aria-pressed={useItemSplit}
              onClick={() => setUseItemSplit(true)}
              className={cn(
                'h-9 rounded-lg border px-2 text-xs font-medium transition-colors sm:text-sm',
                useItemSplit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {p({ th: 'หารตามรายการสินค้า', en: 'Split by item', zh: '按商品分摊' })}
            </button>
            <button
              type="button"
              aria-pressed={!useItemSplit}
              onClick={() => setUseItemSplit(false)}
              className={cn(
                'h-9 rounded-lg border px-2 text-xs font-medium transition-colors sm:text-sm',
                !useItemSplit
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {p({ th: 'หารทั้งบิล', en: 'Split whole bill', zh: '整单分摊' })}
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
              defaultIncludeAll
              initialPayers={splitData?.payers ?? initialData?.payers}
              initialShares={useItemSplit ? undefined : (splitData?.shares ?? initialData?.shares)}
              initialSplitMode={useItemSplit ? 'equal' : (splitData?.splitMode ?? (initialData?.splitMode === 'item' ? 'equal' : initialData?.splitMode as TransactionSplitMode))}
              onChange={handleSplitChange}
            />
            {useItemSplit && inputMode === 'receipt' && (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">
                  {p({ th: 'สรุปการหารรายชิ้น:', en: 'Per-item split summary:', zh: '按商品分摊汇总：' })}
                </p>
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
          <p className="text-xs text-muted-foreground">
            {p({
              th: 'กรอกจำนวนเงินก่อนเพื่อตั้งค่าการแบ่งจ่าย',
              en: 'Enter an amount first to set up the split',
              zh: '请先输入金额再设置分摊',
            })}
          </p>
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
        <Button type="button" variant="outline" onClick={onCancel}>{tr('common.cancel')}</Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? tr('common.saving') : tr('common.save')}
        </Button>
      </div>
    </form>
  )
}
