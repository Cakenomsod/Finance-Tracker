'use client'

import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useFriends, type Contact } from '@/hooks/use-friends'
import { TripExpensePayer, TripExpenseShare } from '@/lib/firestore-types'
import {
  ME_PERSON_ID,
  TransactionSplitMode,
  computeSplitNetBalances,
  computeSplitTransfers,
} from '@/lib/transaction-split'
import { toPaotangEffectivePayerAmount } from '@/lib/transaction-payment'

export interface SplitMember {
  personId: string
  displayName: string
}

export interface TransactionSplitSectionProps {
  total: number
  initialPayers?: TripExpensePayer[]
  initialShares?: TripExpenseShare[]
  initialSplitMode?: TransactionSplitMode
  /** When set, use these members instead of friends contacts (e.g. trip members) */
  members?: SplitMember[]
  /** Currency symbol for amount labels (default ฿) */
  currencySymbol?: string
  /** Person id used for debt preview filter (default Me) */
  previewPersonId?: string
  /** Hide equal/custom/solo controls — payers only (e.g. trip itemised receipt split) */
  hideSplitOptions?: boolean
  /** Use Paotang cash-out (40%) for payer rows in debt preview */
  useEffectivePayerAmounts?: boolean
  /** Strip outer card chrome when nested inside another section */
  embedded?: boolean
  disabled?: boolean
  onChange: (data: {
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: TransactionSplitMode
  }) => void
}

type PayerRow = { personId: string; displayName: string; amount: string }

function contactPersonId(c: Contact): string {
  return c.isSelf ? ME_PERSON_ID : c.displayName
}

export function TransactionSplitSection({
  total,
  initialPayers,
  initialShares,
  initialSplitMode,
  members: membersProp,
  currencySymbol = '฿',
  previewPersonId = ME_PERSON_ID,
  hideSplitOptions = false,
  useEffectivePayerAmounts = false,
  embedded = false,
  disabled,
  onChange,
}: TransactionSplitSectionProps) {
  const { contacts, loading: friendsLoading } = useFriends()

  const contactKey = contacts.map((c) => `${c.key}:${c.displayName}`).join('|')
  const membersFromFriends = React.useMemo(
    () =>
      contacts.map((c) => ({
        personId: contactPersonId(c),
        displayName: c.displayName,
      })),
    [contactKey]
  )
  const members = membersProp ?? membersFromFriends
  const loading = membersProp ? false : friendsLoading

  const [splitMode, setSplitMode] = React.useState<TransactionSplitMode>(
    initialSplitMode || 'equal'
  )

  const [payers, setPayers] = React.useState<PayerRow[]>(() => {
    if (initialPayers?.length) {
      return initialPayers.map((p) => ({
        personId: p.userId,
        displayName: p.displayName,
        amount: String(p.amount),
      }))
    }
    return [{ personId: ME_PERSON_ID, displayName: 'Me', amount: '' }]
  })

  const [equalIncluded, setEqualIncluded] = React.useState<Set<string>>(() => {
    if (initialShares?.length && (initialSplitMode === 'equal' || !initialSplitMode)) {
      return new Set(initialShares.map((s) => s.userId))
    }
    if (initialPayers?.length) {
      return new Set(initialPayers.map((p) => p.userId))
    }
    return new Set([ME_PERSON_ID])
  })

  const [customShares, setCustomShares] = React.useState<Record<string, string>>(() => {
    if (initialShares?.length && initialSplitMode === 'custom') {
      return Object.fromEntries(initialShares.map((s) => [s.userId, String(s.amount)]))
    }
    return {}
  })

  const payerParticipants = React.useMemo(() => {
    const seen = new Set<string>()
    return payers.filter((p) => {
      if (seen.has(p.personId)) return false
      seen.add(p.personId)
      return true
    })
  }, [payers])

  const payerIdsKey = payerParticipants.map((p) => p.personId).join('|')

  React.useEffect(() => {
    setEqualIncluded((prev) => {
      const payerIds = new Set(payerParticipants.map((p) => p.personId))
      const next = new Set<string>()
      let changed = false

      for (const id of prev) {
        if (payerIds.has(id)) next.add(id)
        else changed = true
      }

      for (const p of payerParticipants) {
        if (!next.has(p.personId)) {
          next.add(p.personId)
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [payerIdsKey, payerParticipants])

  React.useEffect(() => {
    if (splitMode !== 'custom') return

    setCustomShares((prev) => {
      const payerIds = new Set(payerParticipants.map((p) => p.personId))
      const next: Record<string, string> = {}
      let changed = false

      for (const p of payerParticipants) {
        if (prev[p.personId] !== undefined) {
          next[p.personId] = prev[p.personId]
        } else {
          next[p.personId] = ''
          changed = true
        }
      }

      for (const id of Object.keys(prev)) {
        if (!payerIds.has(id)) {
          changed = true
          break
        }
      }

      if (!changed && Object.keys(prev).length !== Object.keys(next).length) {
        changed = true
      }

      return changed ? next : prev
    })
  }, [splitMode, payerIdsKey, payerParticipants])

  const initialSplitKey = React.useMemo(
    () =>
      JSON.stringify({
        payers: initialPayers,
        shares: initialShares,
        splitMode: initialSplitMode,
      }),
    [initialPayers, initialShares, initialSplitMode]
  )

  React.useEffect(() => {
    if (initialPayers?.length) {
      setPayers(
        initialPayers.map((p) => ({
          personId: p.userId,
          displayName: p.displayName,
          amount: String(p.amount),
        }))
      )
    }
    if (initialSplitMode) setSplitMode(initialSplitMode)
    if (initialShares?.length) {
      if (initialSplitMode === 'custom') {
        setCustomShares(Object.fromEntries(initialShares.map((s) => [s.userId, String(s.amount)])))
      } else if (initialSplitMode === 'equal' || !initialSplitMode) {
        setEqualIncluded(new Set(initialShares.map((s) => s.userId)))
      }
    }
  }, [initialSplitKey])

  const addPayer = () => {
    const used = new Set(payers.map((p) => p.personId))
    const next = members.find((m) => !used.has(m.personId))
    if (!next) return
    setPayers([...payers, { personId: next.personId, displayName: next.displayName, amount: '' }])
  }

  const removePayer = (idx: number) => {
    if (payers.length <= 1) return
    setPayers(payers.filter((_, i) => i !== idx))
  }

  const updatePayerPerson = (idx: number, personId: string) => {
    const member = members.find((m) => m.personId === personId)
    if (!member) return
    setPayers(payers.map((p, i) => (i === idx ? { ...p, personId, displayName: member.displayName } : p)))
  }

  const updatePayerAmount = (idx: number, val: string) => {
    setPayers(payers.map((p, i) => (i === idx ? { ...p, amount: val } : p)))
  }

  const totalPaid = payers.slice(0, -1).reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const lastPayerSuggestion = Math.max(0, total - totalPaid)
  const equalShareAmount = equalIncluded.size > 0 ? total / equalIncluded.size : 0
  const customTotal = Object.values(customShares).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  const buildResult = React.useMemo((): {
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: TransactionSplitMode
    errors: string[]
  } | null => {
    if (!total || total <= 0) return null

    const errs: string[] = []
    const finalPayers: TripExpensePayer[] = payers.map((p, i) => ({
      userId: p.personId,
      displayName: p.displayName,
      amount:
        i === payers.length - 1 && !p.amount
          ? parseFloat(lastPayerSuggestion.toFixed(2))
          : parseFloat(p.amount) || 0,
    }))

    const paidTotal = finalPayers.reduce((s, p) => s + p.amount, 0)
    if (Math.abs(paidTotal - total) > 1) {
      errs.push(`ยอดที่จ่าย (${currencySymbol}${paidTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (${currencySymbol}${total.toFixed(0)})`)
    }

    let finalShares: TripExpenseShare[] = []

    if (splitMode === 'solo') {
      finalShares = finalPayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        amount: p.amount,
      }))
    } else if (splitMode === 'equal') {
      if (equalIncluded.size === 0) errs.push('กรุณาเลือกอย่างน้อย 1 คน')
      const share = parseFloat((total / equalIncluded.size).toFixed(2))
      finalShares = payerParticipants
        .filter((p) => equalIncluded.has(p.personId))
        .map((p) => ({ userId: p.personId, displayName: p.displayName, amount: share }))
    } else {
      finalShares = payerParticipants
        .filter((p) => customShares[p.personId] && parseFloat(customShares[p.personId]) > 0)
        .map((p) => ({
          userId: p.personId,
          displayName: p.displayName,
          amount: parseFloat(customShares[p.personId]),
        }))
      if (Math.abs(customTotal - total) > 1) {
        errs.push(`ยอดแบ่ง (${currencySymbol}${customTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (${currencySymbol}${total.toFixed(0)})`)
      }
    }

    return { payers: finalPayers, shares: finalShares, splitMode, errors: errs }
  }, [
    total,
    payers,
    lastPayerSuggestion,
    splitMode,
    equalIncluded,
    payerParticipants,
    customShares,
    customTotal,
    currencySymbol,
  ])

  const errors = buildResult?.errors ?? []

  const lastEmitted = React.useRef<string>('')
  const onChangeRef = React.useRef(onChange)
  onChangeRef.current = onChange

  React.useEffect(() => {
    if (!buildResult || buildResult.errors.length > 0) return
    const payload = {
      payers: buildResult.payers,
      shares: buildResult.shares,
      splitMode: buildResult.splitMode,
    }
    const key = JSON.stringify(payload)
    if (key === lastEmitted.current) return
    lastEmitted.current = key
    onChangeRef.current(payload)
  }, [buildResult])

  const preview = React.useMemo(() => {
    if (!buildResult || buildResult.errors.length > 0 || total <= 0) return null
    const payersForPreview = useEffectivePayerAmounts
      ? buildResult.payers.map((p) => ({
          ...p,
          amount: toPaotangEffectivePayerAmount(p.amount),
        }))
      : buildResult.payers
    const net = computeSplitNetBalances(payersForPreview, buildResult.shares)
    return computeSplitTransfers(net).filter(
      (t) => t.from === previewPersonId || t.to === previewPersonId
    )
  }, [buildResult, total, previewPersonId, useEffectivePayerAmounts])

  if (loading) {
    return <p className="text-sm text-muted-foreground">กำลังโหลดรายชื่อ...</p>
  }

  return (
    <div
      className={cn(
        embedded ? 'space-y-3' : 'space-y-3 rounded-lg border bg-muted/20 p-3 sm:p-4'
      )}
    >
      {!embedded && <p className="text-sm font-medium">แบ่งจ่าย / หนี้</p>}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-xs sm:text-sm">ใครจ่าย?</Label>
          {payers.length < members.length && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPayer}
              disabled={disabled}
              className="h-7 shrink-0 gap-1 px-2 text-xs"
            >
              <Plus className="size-3" /> เพิ่ม
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {payers.map((payer, idx) => (
            <div key={idx} className="space-y-0.5">
              <div className="grid grid-cols-[1fr_5.25rem_2rem] items-center gap-1.5 sm:grid-cols-[1fr_6rem_2rem] sm:gap-2">
                <Select
                  value={payer.personId}
                  onValueChange={(v) => updatePayerPerson(idx, v)}
                  disabled={disabled}
                >
                  <SelectTrigger className="h-8 min-w-0 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem
                        key={m.personId}
                        value={m.personId}
                        disabled={payers.some((p, i) => i !== idx && p.personId === m.personId)}
                      >
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 pl-5 text-xs"
                    disabled={disabled}
                    placeholder={idx === payers.length - 1 ? String(lastPayerSuggestion.toFixed(0)) : '0'}
                    value={payer.amount}
                    onChange={(e) => updatePayerAmount(idx, e.target.value)}
                  />
                </div>
                {payers.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    disabled={disabled}
                    onClick={() => removePayer(idx)}
                  >
                    <Minus className="size-3.5" />
                  </Button>
                ) : (
                  <div className="size-8 shrink-0" />
                )}
              </div>
              {useEffectivePayerAmounts && parseFloat(payer.amount) > 0 && (
                <p className="text-[10px] text-muted-foreground tabular-nums pl-0.5">
                  จ่ายจริง {currencySymbol}
                  {toPaotangEffectivePayerAmount(parseFloat(payer.amount) || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {!hideSplitOptions && (
      <div className="space-y-2">
        <Label className="text-xs sm:text-sm">แบ่งจ่ายแบบไหน?</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { value: 'equal' as const, label: '⚖️ เฉลี่ย' },
            { value: 'custom' as const, label: '✏️ กำหนด' },
            { value: 'solo' as const, label: '🙋 เดียว' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setSplitMode(opt.value)}
              className={cn(
                'rounded-lg border px-1.5 py-1.5 text-[11px] font-medium transition-all sm:px-2 sm:py-2 sm:text-xs',
                splitMode === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {splitMode === 'equal' && (
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">
              เลือกจากผู้จ่ายเท่านั้น ({equalIncluded.size} คน → คนละ {currencySymbol}
              {equalShareAmount.toFixed(0)})
            </p>
            {payerParticipants.length === 0 ? (
              <p className="text-xs text-muted-foreground">เพิ่มผู้จ่ายก่อน</p>
            ) : (
            <div className="flex flex-wrap gap-2">
              {payerParticipants.map((p) => {
                const on = equalIncluded.has(p.personId)
                const isLastSelected = on && equalIncluded.size === 1
                return (
                  <button
                    key={p.personId}
                    type="button"
                    disabled={disabled || isLastSelected}
                    onClick={() => {
                      const next = new Set(equalIncluded)
                      if (on) next.delete(p.personId)
                      else next.add(p.personId)
                      setEqualIncluded(next)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50',
                      isLastSelected && 'opacity-90'
                    )}
                  >
                    {p.displayName}
                  </button>
                )
              })}
            </div>
            )}
          </div>
        )}

        {splitMode === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              กรอกจำนวนของแต่ละคนที่จ่าย (รวม: {currencySymbol}{customTotal.toFixed(0)} / {currencySymbol}{total.toFixed(0)})
            </p>
            {payerParticipants.map((p) => (
              <div key={p.personId} className="grid grid-cols-[1fr_5.25rem] items-center gap-1.5 sm:gap-2">
                <span className="min-w-0 truncate text-xs sm:text-sm">{p.displayName}</span>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 pl-5 text-xs"
                    disabled={disabled}
                    placeholder="0"
                    value={customShares[p.personId] || ''}
                    onChange={(e) =>
                      setCustomShares({ ...customShares, [p.personId]: e.target.value })
                    }
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
      )}

      {errors.length > 0 && (
        <div className="space-y-1 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {errors.map((e, i) => (
            <p key={i}>• {e}</p>
          ))}
        </div>
      )}

      {preview && preview.length > 0 && total > 0 && (
        <div className="space-y-1 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">สรุปหนี้ที่เกี่ยวกับคุณ</p>
          {preview.map((t, i) => {
            const fromName = t.from === previewPersonId ? 'คุณ' : members.find(m => m.personId === t.from)?.displayName || t.from
            const toName = t.to === previewPersonId ? 'คุณ' : members.find(m => m.personId === t.to)?.displayName || t.to
            return (
              <p key={i}>
                {fromName} คืน {toName} {currencySymbol}{t.amount.toLocaleString()}
              </p>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function validateTransactionSplit(
  total: number,
  payers: TripExpensePayer[],
  shares: TripExpenseShare[]
): string[] {
  const errs: string[] = []
  if (!total || total <= 0) return errs
  const paidTotal = payers.reduce((s, p) => s + p.amount, 0)
  const shareTotal = shares.reduce((s, sh) => s + sh.amount, 0)
  if (Math.abs(paidTotal - total) > 1) {
    errs.push(`ยอดที่จ่ายไม่ตรงกับยอดรวม`)
  }
  if (Math.abs(shareTotal - total) > 1) {
    errs.push(`ยอดแบ่งไม่ตรงกับยอดรวม`)
  }
  return errs
}
