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

type SplitMode = 'equal' | 'custom' | 'solo'

const categories = [
  'Food & Dining', 'Transport', 'Shopping', 'Entertainment',
  'Bills & Utilities', 'Health & Fitness', 'Accommodation', 'Activities', 'Others',
]

export function TripExpenseFormV2({
  tripMembers, myUserId, initialData, onSubmit, onCancel,
}: TripExpenseFormV2Props) {
  const [description, setDescription] = React.useState(initialData?.description || '')
  const [totalAmount, setTotalAmount] = React.useState(initialData ? String(initialData.totalAmount) : '')
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

  const total = parseFloat(totalAmount) || 0

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
    if (Math.abs(paidTotal - total) > 1) errs.push(`ยอดที่จ่าย (฿${paidTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (฿${total.toFixed(0)})`)

    let finalShares: TripExpenseShare[] = []

    if (splitMode === 'solo') {
      finalShares = finalPayers.map(p => ({ userId: p.userId, displayName: p.displayName, amount: p.amount }))
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
      if (Math.abs(customTotal - total) > 1) errs.push(`ยอดแบ่ง (฿${customTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (฿${total.toFixed(0)})`)
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
      await onSubmit({
        description,
        totalAmount: total,
        category,
        date: Timestamp.fromDate(new Date(date)),
        note: note || undefined,
        splitMode,
        payers: result.payers,
        shares: result.shares,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 py-2">
      {/* Description */}
      <div className="space-y-1.5">
        <Label>รายละเอียด</Label>
        <Textarea placeholder="เช่น อาหารมื้อเย็น, ค่าแท็กซี่..." className="resize-none"
          value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {/* Amount + Category + Date */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>ยอดรวม (฿)</Label>
          <Input type="number" step="0.01" placeholder="0.00"
            value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
        </div>
        <div className="space-y-1.5">
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
        <div className="flex gap-2">
          {[
            { value: 'equal', label: '⚖️ เฉลี่ยเท่ากัน' },
            { value: 'custom', label: '✏️ กำหนดเอง' },
            { value: 'solo', label: '🙋 คนเดียว' },
          ].map(opt => (
            <button key={opt.value} type="button"
              onClick={() => setSplitMode(opt.value as SplitMode)}
              className={cn(
                'flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all',
                splitMode === opt.value
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:border-primary/50'
              )}>
              {opt.label}
            </button>
          ))}
        </div>

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
