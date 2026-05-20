'use client'

import * as React from 'react'
import { Plus, Minus, ImagePlus, X, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { collectImmichAssetIds } from '@/lib/immich/asset-ids'
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser'
import { cn } from '@/lib/utils'
import { TaxCategoryId, TripExpense, TripExpensePayer, TripExpenseShare, TripCurrency } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'
import {
  getCountryConfig, getDefaultTaxCategory, type TaxMode,
} from '@/lib/tax/countries'
import { calculateLineTax, roundMoney } from '@/lib/tax/calculate'
import { formatCurrencySymbol, formatHomeConversion } from '@/lib/trip-currency'

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
  /** Trip id for Immich upload (album routing) */
  tripId?: string
  pendingImmichAssetIds?: string[]
  onSubmit: (data: Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId'>) => Promise<void>
  onCancel: () => void
}

type SplitMode = 'equal' | 'custom' | 'solo' | 'item'

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
  const [description, setDescription] = React.useState(initialData?.description || '')
  const [totalAmount, setTotalAmount] = React.useState(initialData ? String(initialData.totalAmount) : '')
  const [subtotal, setSubtotal] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.baseAmount ? String(initialData.baseAmount) : '')
  const [tax, setTax] = React.useState(initialData && initialData.items && initialData.items.length === 0 && initialData.taxAmount ? String(initialData.taxAmount) : '')
  const [category, setCategory] = React.useState(initialData?.category || '')
  const [date, setDate] = React.useState(
    initialData?.date?.seconds
      ? new Date(initialData.date.seconds * 1000).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [note, setNote] = React.useState(initialData?.note || '')
  const [splitMode, setSplitMode] = React.useState<SplitMode>(
    (initialData?.splitMode as SplitMode) || 'equal'
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

  // Payers state: [{key, displayName, amount}]
  const [payers, setPayers] = React.useState<{ key: string; displayName: string; amount: string }[]>(
    initialData?.payers.map(p => ({ key: p.userId, displayName: p.displayName, amount: String(p.amount) }))
    || [{ key: myUserId, displayName: tripMembers.find(m => m.key === myUserId)?.displayName || 'Me', amount: '' }]
  )

  // Equal split: which members are included
  const [equalIncluded, setEqualIncluded] = React.useState<Set<string>>(
    new Set(initialData?.shares.map(s => s.userId) || tripMembers.map(m => m.key))
  )

  // Custom shares: {key -> amount string}
  const [customShares, setCustomShares] = React.useState<Record<string, string>>(
    initialData?.splitMode === 'custom'
      ? Object.fromEntries(initialData.shares.map(s => [s.userId, String(s.amount)]))
      : {}
  )

  const [submitting, setSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<string[]>([])
  const [attachmentIds, setAttachmentIds] = React.useState<string[]>(() =>
    collectImmichAssetIds({
      immichAssetId: initialData?.immichAssetId ?? immichAssetId,
      immichAssetIds: initialData?.immichAssetIds,
    })
  )
  const [lightboxAssetId, setLightboxAssetId] = React.useState<string | null>(null)
  const [uploadingAttach, setUploadingAttach] = React.useState(false)
  const attachInputRef = React.useRef<HTMLInputElement>(null)

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
  const [currency, setCurrency] = React.useState<TripCurrency>(
    initialData?.currency || tripDefaults?.tripCurrency || 'THB'
  )
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

  const manualTotal = parseFloat(totalAmount) || 0
  const total = isReceiptActive ? totalReceiptAmount : manualTotal

  // --- Payers helpers ---
  const addPayer = () => {
    const used = new Set(payers.map(p => p.key))
    const next = tripMembers.find(m => !used.has(m.key))
    if (!next) return
    setPayers([...payers, { key: next.key, displayName: next.displayName, amount: '' }])
  }

  const removePayer = (idx: number) => {
    if (payers.length <= 1) return
    setPayers(payers.filter((_, i) => i !== idx))
  }

  const updatePayerMember = (idx: number, key: string) => {
    const member = tripMembers.find(m => m.key === key)!
    setPayers(payers.map((p, i) => i === idx ? { ...p, key, displayName: member.displayName } : p))
  }

  const updatePayerAmount = (idx: number, val: string) => {
    setPayers(payers.map((p, i) => i === idx ? { ...p, amount: val } : p))
  }

  // Auto-fill last payer to make total
  const totalPaid = payers.slice(0, -1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const lastPayerSuggestion = Math.max(0, total - totalPaid)

  // Equal shares
  const equalShareAmount = equalIncluded.size > 0 ? total / equalIncluded.size : 0

  // Custom shares total
  const customTotal = Object.values(customShares).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  // --- Build final payers/shares for submission ---
  const buildPayersShares = (): { payers: TripExpensePayer[]; shares: TripExpenseShare[] } | null => {
    const errs: string[] = []

    if (!description.trim()) errs.push('กรุณากรอกรายละเอียด')
    if (!total || total <= 0) errs.push('กรุณากรอกจำนวนเงิน')
    if (!category) errs.push('กรุณาเลือกหมวดหมู่')

    const finalPayers: TripExpensePayer[] = payers.map((p, i) => ({
      userId: p.key,
      displayName: p.displayName,
      amount: i === payers.length - 1 && !p.amount
        ? parseFloat(lastPayerSuggestion.toFixed(2))
        : parseFloat(p.amount) || 0,
    }))

    const paidTotal = finalPayers.reduce((s, p) => s + p.amount, 0)
    if (Math.abs(paidTotal - total) > 1) errs.push(`ยอดที่จ่าย (${curSymbol}${paidTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (${curSymbol}${total.toFixed(0)})`)

    let finalShares: TripExpenseShare[] = []

    if (splitMode === 'solo') {
      finalShares = finalPayers.map(p => ({ userId: p.userId, displayName: p.displayName, amount: p.amount }))
    } else if (splitMode === 'item') {
      if (!isReceiptActive) {
        errs.push('กรุณากรอกรายการสินค้าเพื่อใช้โหมดแบ่งจ่ายรายชิ้น')
      } else {
        finalShares = tripMembers.map(m => ({
          userId: m.key,
          displayName: m.displayName,
          amount: parseFloat((itemShares[m.key] || 0).toFixed(2))
        }))
      }
    } else if (splitMode === 'equal') {
      if (equalIncluded.size === 0) errs.push('กรุณาเลือกอย่างน้อย 1 คน')
      const share = parseFloat((total / equalIncluded.size).toFixed(2))
      finalShares = tripMembers
        .filter(m => equalIncluded.has(m.key))
        .map(m => ({ userId: m.key, displayName: m.displayName, amount: share }))
    } else {
      // custom
      finalShares = tripMembers
        .filter(m => customShares[m.key] && parseFloat(customShares[m.key]) > 0)
        .map(m => ({ userId: m.key, displayName: m.displayName, amount: parseFloat(customShares[m.key]) }))
      if (Math.abs(customTotal - total) > 1) errs.push(`ยอดแบ่ง (${curSymbol}${customTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (${curSymbol}${total.toFixed(0)})`)
    }

    setErrors(errs)
    if (errs.length > 0) return null
    return { payers: finalPayers, shares: finalShares }
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
        date: Timestamp.fromDate(new Date(date)),
        note: note || undefined,
        splitMode,
        payers: result.payers,
        shares: result.shares,
        currency,
        source: initialData?.source || 'manual',
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
        payload.immichAssetIds = attachmentIds
      } else {
        payload.immichAssetIds = undefined
        payload.immichAssetId = null
      }

      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddAttachment = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploadingAttach(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('filename', file.name)
      if (tripId) form.append('tripId', tripId)
      const res = await fetch('/api/immich/upload', { method: 'POST', body: form, credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setAttachmentIds((prev) => [...prev, data.assetId as string])
    } catch (e) {
      console.error(e)
    } finally {
      setUploadingAttach(false)
    }
  }

  const handleRemoveAttachment = async (id: string) => {
    await requestDeleteImmichAssets([id])
    setAttachmentIds((prev) => prev.filter((x) => x !== id))
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-2">
      <div className="rounded-lg border bg-muted/40 p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">รูปแนบ (Immich)</p>
          <input
            ref={attachInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleAddAttachment(f)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={uploadingAttach}
            onClick={() => attachInputRef.current?.click()}
          >
            {uploadingAttach ? '...' : <><ImagePlus className="size-3.5" /> เพิ่มรูป</>}
          </Button>
        </div>
        {attachmentIds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">ไม่มีรูป — กด เพิ่มรูป หรือใช้ AI แนบโน้ต</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {attachmentIds.map((id) => (
              <div
                key={id}
                className="relative group w-20 h-20 rounded-md border bg-background overflow-hidden shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/immich/asset/${id}?type=thumbnail`}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightboxAssetId(id)}
                />
              <button
                type="button"
                className="absolute top-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => handleRemoveAttachment(id)}
                aria-label="ลบรูป"
              >
                <X className="size-3.5" />
              </button>
                <button
                  type="button"
                  className="absolute bottom-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setLightboxAssetId(id)}
                  aria-label="ขยาย"
                >
                  <Maximize2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!lightboxAssetId} onOpenChange={(o) => !o && setLightboxAssetId(null)}>
        <DialogContent className="max-w-[min(96vw,900px)] p-2 sm:p-4">
          <DialogHeader className="sr-only">
            <DialogTitle>ดูรูปแนบ</DialogTitle>
          </DialogHeader>
          {lightboxAssetId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/immich/asset/${lightboxAssetId}?type=original`}
              alt="รูปแนบขนาดใหญ่"
              className="w-full max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
      {/* Input Mode Selector */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => {
            setInputMode('standard')
            if (splitMode === 'item') setSplitMode('equal')
          }}
          className={cn(
            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
            inputMode === 'standard' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          Standard Input
        </button>
        <button
          type="button"
          onClick={() => {
            setInputMode('receipt')
            setSplitMode('item')
          }}
          className={cn(
            "flex-1 py-1.5 text-xs font-medium rounded-md transition-all",
            inputMode === 'receipt' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          🧾 Receipt Input
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
        <div className="grid grid-cols-3 gap-3 border p-3 rounded-lg bg-muted/20">
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
                const sub = parseFloat(val) || 0
                const tx = parseFloat(tax) || 0
                setTotalAmount(sub > 0 || tx > 0 ? (sub + tx).toString() : '')
              }}
              className="h-9 text-xs"
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
                const sub = parseFloat(subtotal) || 0
                const tx = parseFloat(val) || 0
                setTotalAmount(sub > 0 || tx > 0 ? (sub + tx).toString() : '')
              }}
              className="h-9 text-xs"
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
              className="h-9 text-xs font-semibold border-primary/40 focus-visible:ring-primary"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {inputMode === 'receipt' && (
          <div className="space-y-1.5">
            <Label>ยอดรวม ({curSymbol})</Label>
            <Input type="number" step="0.01" placeholder="0.00"
              disabled={true}
              value={totalReceiptAmount.toFixed(2)} />
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
      <div className="space-y-1.5">
        <Label>วันที่</Label>
        <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>

      {/* Receipt Items (Only in Receipt Mode) */}
      {inputMode === 'receipt' && (
        <div className="space-y-4 border rounded-lg p-3 bg-muted/20 overflow-hidden">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-1">
            <div className="flex items-center gap-3">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Receipt Items</h4>
              {/* Premium Tax Mode Switch Toggle */}
              <div className="inline-flex rounded-lg border p-0.5 bg-muted/60 text-[10px] shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setReceiptTaxMode('exclusive')}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-all",
                    receiptTaxMode === 'exclusive'
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  ยังไม่รวมภาษี (Exclusive)
                </button>
                <button
                  type="button"
                  onClick={() => setReceiptTaxMode('inclusive')}
                  className={cn(
                    "px-2 py-0.5 rounded-md font-medium transition-all",
                    receiptTaxMode === 'inclusive'
                      ? "bg-background text-foreground shadow-sm font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  รวมภาษีแล้ว (Inclusive)
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
                <div key={idx} className="border-b pb-3 last:border-b-0 last:pb-0 pt-2">
                  <div className="flex items-center gap-2 w-full overflow-hidden">
                    {/* Name Input - Premium Sizing */}
                    <Input
                      placeholder="Product Name"
                      className="flex-grow min-w-[120px] h-9 text-xs shrink"
                      value={item.name}
                      onChange={e => {
                        const next = [...receiptItems]
                        next[idx].name = e.target.value
                        setReceiptItems(next)
                      }}
                    />

                    {/* Category Selector */}
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
                      <SelectTrigger className="w-24 sm:w-28 h-9 text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                      </SelectContent>
                    </Select>

                    {hasAutoTax && taxRules.length > 0 && (
                      <Select
                        value={item.taxCategoryId}
                        onValueChange={val => {
                          const next = [...receiptItems]
                          next[idx].taxCategoryId = val as TaxCategoryId
                          setReceiptItems(next)
                        }}
                      >
                        <SelectTrigger className="w-[88px] sm:w-24 h-9 text-[10px] shrink-0">
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

                    {/* Price Input */}
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">
                        {curSymbol}
                      </span>
                      <Input
                        type="number"
                        placeholder={receiptTaxMode === 'exclusive' ? "Excl. Tax" : "Incl. Tax"}
                        className="pl-6 pr-1 h-9 text-xs font-medium"
                        value={item.price}
                        onChange={e => {
                          const next = [...receiptItems]
                          next[idx].price = e.target.value
                          setReceiptItems(next)
                        }}
                      />
                    </div>

                    {/* Calculated Total */}
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0 min-w-[72px] text-right">
                      ={curSymbol}{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      {hasAutoTax && t > 0 && (
                        <span className="block text-[9px] font-normal text-muted-foreground/80">
                          ภาษี {curSymbol}{t.toFixed(0)}
                        </span>
                      )}
                    </span>

                    {/* Split buttons */}
                    <div className="flex items-center gap-0.5 shrink-0 flex-wrap">
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

                    {/* Delete Product Button */}
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

          {/* Receipt Level Summary & Tax Breakdown */}
          <div className="grid grid-cols-3 gap-3 border-t pt-4 mt-2">
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
              <Label className="text-xs text-muted-foreground font-bold text-foreground">ยอดรวมสุทธิ (Total)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {curSymbol}
                </span>
                <Input
                  type="number"
                  disabled
                  className="pl-6 h-9 text-xs bg-muted/30 font-bold tabular-nums text-foreground border-muted-foreground/30"
                  value={totalReceiptAmount.toFixed(2)}
                />
              </div>
              {homeHint(totalReceiptAmount) && (
                <p className="text-[10px] text-muted-foreground">≈ {homeHint(totalReceiptAmount)}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Payers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>ใครจ่าย?</Label>
          {payers.length < tripMembers.length && (
            <Button type="button" variant="ghost" size="sm" onClick={addPayer} className="h-7 text-xs gap-1">
              <Plus className="size-3" /> เพิ่มคนจ่าย
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {payers.map((payer, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select value={payer.key} onValueChange={k => updatePayerMember(idx, k)}>
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tripMembers.map(m => (
                    <SelectItem key={m.key} value={m.key}
                      disabled={payers.some((p, i) => i !== idx && p.key === m.key)}>
                      {m.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="relative w-28">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{curSymbol}</span>
                <Input
                  type="number" step="0.01" className="pl-6"
                  placeholder={idx === payers.length - 1 ? String(lastPayerSuggestion.toFixed(0)) : '0'}
                  value={payer.amount}
                  onChange={e => updatePayerAmount(idx, e.target.value)}
                />
              </div>
              {payers.length > 1 && (
                <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0"
                  onClick={() => removePayer(idx)}>
                  <Minus className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Split Mode */}
      <div className="space-y-3">
        <Label>แบ่งจ่ายแบบไหน?</Label>
        <div className="flex flex-wrap gap-2">
          {[
            ...(inputMode === 'receipt' ? [{ value: 'item', label: '🧾 หารแยกสินค้า' }] : []),
            { value: 'equal', label: '⚖️ เฉลี่ยเท่ากัน' },
            { value: 'custom', label: '✏️ กำหนดเอง' },
            { value: 'solo', label: '🙋 คนเดียว' },
          ].map(opt => (
            <button key={opt.value} type="button"
              onClick={() => setSplitMode(opt.value as SplitMode)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all min-w-[80px] whitespace-nowrap',
                splitMode === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50'
              )}>
              {opt.label}
            </button>
          ))}
        </div>

        {/* Itemised Split Summary */}
        {splitMode === 'item' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">สรุปการหารรายชิ้น:</p>
            <div className="space-y-1 bg-muted/30 p-2.5 rounded-lg text-xs text-muted-foreground">
              {tripMembers.map(m => (
                <div key={m.key} className="flex justify-between">
                  <span>{m.displayName}</span>
                  <span className="font-semibold tabular-nums text-foreground">{curSymbol}{(itemShares[m.key] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equal — member toggles */}
        {splitMode === 'equal' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">เลือกคนที่หารด้วย ({equalIncluded.size} คน → คนละ {curSymbol}{equalShareAmount.toFixed(0)})</p>
            <div className="flex flex-wrap gap-2">
              {tripMembers.map(m => {
                const on = equalIncluded.has(m.key)
                return (
                  <button key={m.key} type="button"
                    onClick={() => {
                      const next = new Set(equalIncluded)
                      on ? next.delete(m.key) : next.add(m.key)
                      setEqualIncluded(next)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      on ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'
                    )}>
                    {m.displayName}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Custom shares */}
        {splitMode === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              กรอกจำนวนของแต่ละคน (รวม: {curSymbol}{customTotal.toFixed(0)} / {curSymbol}{total.toFixed(0)})
            </p>
            {tripMembers.map(m => (
              <div key={m.key} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{m.displayName}</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{curSymbol}</span>
                  <Input type="number" step="0.01" className="pl-6"
                    placeholder="0"
                    value={customShares[m.key] || ''}
                    onChange={e => setCustomShares({ ...customShares, [m.key]: e.target.value })}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {splitMode === 'solo' && (
          <p className="text-xs text-muted-foreground">คนที่จ่ายรับผิดชอบทั้งหมด ไม่หารกับใคร</p>
        )}
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label>หมายเหตุ (ไม่บังคับ)</Label>
        <Input placeholder="..." value={note} onChange={e => setNote(e.target.value)} />
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="rounded-md bg-destructive/10 p-3 text-xs text-destructive space-y-1">
          {errors.map((e, i) => <p key={i}>• {e}</p>)}
        </div>
      )}

      {/* Summary */}
      {total > 0 && (
        <div className="rounded-lg bg-muted p-3 text-xs space-y-1 text-muted-foreground">
          <p className="font-medium text-foreground">สรุป</p>
          {payers.map((p, i) => (
            <p key={i}>💳 {p.displayName} จ่าย {curSymbol}{parseFloat(p.amount || (i === payers.length - 1 ? String(lastPayerSuggestion) : '0')).toFixed(0)}</p>
          ))}
          {splitMode === 'item' && (
            <p>🧾 หารแยกรายชิ้นตามรายการใบเสร็จ</p>
          )}
          {splitMode === 'equal' && equalIncluded.size > 0 && (
            <p>⚖️ หาร {equalIncluded.size} คน → คนละ {curSymbol}{equalShareAmount.toFixed(0)}</p>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>ยกเลิก</Button>
        <Button type="submit" disabled={submitting}>{submitting ? 'กำลังบันทึก...' : 'บันทึก'}</Button>
      </div>
    </form>
  )
}
