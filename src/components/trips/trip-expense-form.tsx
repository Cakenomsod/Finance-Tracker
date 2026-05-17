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
import { cn } from '@/lib/utils'
import { TripExpense, TripExpensePayer, TripExpenseShare } from '@/lib/firestore-types'
import { Timestamp } from 'firebase/firestore'

interface Member {
  key: string
  displayName: string
}

interface TripExpenseFormV2Props {
  tripMembers: Member[]
  myUserId: string
  initialData?: TripExpense | null
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
  splitWith: string[]
}

export function TripExpenseFormV2({
  tripMembers, myUserId, initialData, onSubmit, onCancel,
}: TripExpenseFormV2Props) {
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
      price: String(item.price),
      tax: String(item.tax),
      splitWith: item.splitWith || tripMembers.map(m => m.key),
    })) || [
      { name: '', category: 'Food & Dining', price: '', tax: '', splitWith: tripMembers.map(m => m.key) }
    ]
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
  const [currency, setCurrency] = React.useState<'THB' | 'JPY'>(initialData?.currency || 'THB')
  const [receiptTaxMode, setReceiptTaxMode] = React.useState<'exclusive' | 'inclusive'>('exclusive')
  const [receiptTax, setReceiptTax] = React.useState(
    initialData?.taxAmount 
      ? String(initialData.taxAmount) 
      : (initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0) || 0) > 0
        ? String(initialData?.items?.reduce((sum, item) => sum + (item.tax || 0), 0))
        : ''
  )

  // --- Real-time Receipt calculations ---
  const isReceiptActive = inputMode === 'receipt' && receiptItems.some(item => (parseFloat(item.price) || 0) > 0)

  let totalBaseAmount = 0
  let totalTaxAmount = parseFloat(receiptTax) || 0
  let totalReceiptAmount = 0

  if (isReceiptActive) {
    if (receiptTaxMode === 'exclusive') {
      receiptItems.forEach(item => {
        totalBaseAmount += parseFloat(item.price) || 0
      })
      totalReceiptAmount = totalBaseAmount + totalTaxAmount
    } else {
      // Inclusive: sum of item prices is the total receipt amount
      receiptItems.forEach(item => {
        totalReceiptAmount += parseFloat(item.price) || 0
      })
      totalBaseAmount = Math.max(0, totalReceiptAmount - totalTaxAmount)
    }
  }

  const itemShares: Record<string, number> = {}
  tripMembers.forEach(m => { itemShares[m.key] = 0 })

  receiptItems.forEach(item => {
    const rawVal = parseFloat(item.price) || 0
    let p = 0
    let t = 0
    let itemTotal = 0

    if (receiptTaxMode === 'exclusive') {
      p = rawVal
      t = totalBaseAmount > 0 ? (p / totalBaseAmount) * totalTaxAmount : 0
      itemTotal = p + t
    } else {
      itemTotal = rawVal
      t = totalReceiptAmount > 0 ? (itemTotal / totalReceiptAmount) * totalTaxAmount : 0
      p = Math.max(0, itemTotal - t)
    }

    if (itemTotal > 0 && item.splitWith.length > 0) {
      const share = itemTotal / item.splitWith.length
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

    const curSymbol = currency === 'THB' ? '฿' : '¥'
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
      }

      if (isReceiptActive) {
        payload.items = receiptItems.map(item => {
          const rawVal = parseFloat(item.price) || 0
          let p = 0
          let t = 0
          if (receiptTaxMode === 'exclusive') {
            p = rawVal
            t = totalBaseAmount > 0 ? (p / totalBaseAmount) * totalTaxAmount : 0
          } else {
            const itemTotal = rawVal
            t = totalReceiptAmount > 0 ? (itemTotal / totalReceiptAmount) * totalTaxAmount : 0
            p = Math.max(0, itemTotal - t)
          }
          return {
            name: item.name || 'Item',
            category: item.category,
            price: parseFloat(p.toFixed(2)),
            tax: parseFloat(t.toFixed(2)),
            splitWith: item.splitWith,
          }
        })
        payload.baseAmount = totalBaseAmount
        payload.taxAmount = totalTaxAmount
        payload.taxMode = receiptTaxMode
      } else {
        payload.baseAmount = parseFloat(subtotal) || total || 0
        payload.taxAmount = parseFloat(tax) || 0
      }

      await onSubmit(payload)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-2">
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
            <Label className="text-xs">ราคาสินค้า ({currency === 'THB' ? '฿' : '¥'})</Label>
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
            <Label className="text-xs">ภาษี ({currency === 'THB' ? '฿' : '¥'})</Label>
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
            <Label className="text-xs font-semibold text-primary">ยอดรวม ({currency === 'THB' ? '฿' : '¥'})</Label>
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
            <Label>ยอดรวม ({currency === 'THB' ? '฿' : '¥'})</Label>
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
              onClick={() => setReceiptItems([...receiptItems, { name: '', category: 'Food & Dining', price: '', tax: '', splitWith: tripMembers.map(m => m.key) }])}
              className="h-7 text-xs gap-1"
            >
              <Plus className="size-3" /> Add Product
            </Button>
          </div>

          <div className="space-y-3">
            {receiptItems.map((item, idx) => {
              const rawVal = parseFloat(item.price) || 0
              let p = 0
              let t = 0
              let itemTotal = 0

              if (receiptTaxMode === 'exclusive') {
                p = rawVal
                t = totalBaseAmount > 0 ? (p / totalBaseAmount) * totalTaxAmount : 0
                itemTotal = p + t
              } else {
                itemTotal = rawVal
                t = totalReceiptAmount > 0 ? (itemTotal / totalReceiptAmount) * totalTaxAmount : 0
                p = Math.max(0, itemTotal - t)
              }

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

                    {/* Price Input */}
                    <div className="relative w-24 shrink-0">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-[10px]">
                        {currency === 'THB' ? '฿' : '¥'}
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

                    {/* Calculated Total (Price + Proportional Tax) */}
                    <span className="text-xs font-semibold text-muted-foreground tabular-nums shrink-0 min-w-[60px] text-right">
                      ={currency === 'THB' ? '฿' : '¥'}{itemTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  {currency === 'THB' ? '฿' : '¥'}
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
              <Label className="text-xs text-muted-foreground font-semibold text-primary">ภาษีรวมทั้งใบเสร็จ (Tax)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {currency === 'THB' ? '฿' : '¥'}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  className="pl-6 h-9 text-xs font-semibold border-primary/40 focus-visible:ring-primary"
                  value={receiptTax}
                  onChange={e => setReceiptTax(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground font-bold text-foreground">ยอดรวมสุทธิ (Total)</Label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                  {currency === 'THB' ? '฿' : '¥'}
                </span>
                <Input
                  type="number"
                  disabled
                  className="pl-6 h-9 text-xs bg-muted/30 font-bold tabular-nums text-foreground border-muted-foreground/30"
                  value={totalReceiptAmount.toFixed(2)}
                />
              </div>
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
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
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
                  <span className="font-semibold tabular-nums text-foreground">฿{(itemShares[m.key] || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Equal — member toggles */}
        {splitMode === 'equal' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">เลือกคนที่หารด้วย ({equalIncluded.size} คน → คนละ ฿{equalShareAmount.toFixed(0)})</p>
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
              กรอกจำนวนของแต่ละคน (รวม: ฿{customTotal.toFixed(0)} / ฿{total.toFixed(0)})
            </p>
            {tripMembers.map(m => (
              <div key={m.key} className="flex items-center gap-2">
                <span className="flex-1 text-sm">{m.displayName}</span>
                <div className="relative w-28">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">฿</span>
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
            <p key={i}>💳 {p.displayName} จ่าย ฿{parseFloat(p.amount || (i === payers.length - 1 ? String(lastPayerSuggestion) : '0')).toFixed(0)}</p>
          ))}
          {splitMode === 'item' && (
            <p>🧾 หารแยกรายชิ้นตามรายการใบเสร็จ</p>
          )}
          {splitMode === 'equal' && equalIncluded.size > 0 && (
            <p>⚖️ หาร {equalIncluded.size} คน → คนละ ฿{equalShareAmount.toFixed(0)}</p>
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
