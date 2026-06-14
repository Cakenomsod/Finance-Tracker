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
    return new Set(members.map((m) => m.personId))
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
      finalShares = members
        .filter((m) => equalIncluded.has(m.personId))
        .map((m) => ({ userId: m.personId, displayName: m.displayName, amount: share }))
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
    members,
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
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">แบ่งจ่าย / หนี้</p>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>ใครจ่าย?</Label>
          {payers.length < members.length && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPayer}
              disabled={disabled}
              className="h-7 gap-1 text-xs"
            >
              <Plus className="size-3" /> เพิ่มคนจ่าย
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {payers.map((payer, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Select
                value={payer.personId}
                onValueChange={(v) => updatePayerPerson(idx, v)}
                disabled={disabled}
              >
                <SelectTrigger className="flex-1">
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
              <div className="relative w-28 shrink-0">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {currencySymbol}
                </span>
                <Input
                  type="number"
                  step="0.01"
                  className="pl-6"
                  disabled={disabled}
                  placeholder={idx === payers.length - 1 ? String(lastPayerSuggestion.toFixed(0)) : '0'}
                  value={payer.amount}
                  onChange={(e) => updatePayerAmount(idx, e.target.value)}
                />
                {useEffectivePayerAmounts && parseFloat(payer.amount) > 0 && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">
                    จ่ายจริง {currencySymbol}
                    {toPaotangEffectivePayerAmount(parseFloat(payer.amount) || 0).toLocaleString(undefined, {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                )}
              </div>
              {payers.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 shrink-0"
                  disabled={disabled}
                  onClick={() => removePayer(idx)}
                >
                  <Minus className="size-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {!hideSplitOptions && (
      <div className="space-y-3">
        <Label>แบ่งจ่ายแบบไหน?</Label>
        <div className="flex flex-wrap gap-2">
          {[
            { value: 'equal' as const, label: '⚖️ เฉลี่ยเท่ากัน' },
            { value: 'custom' as const, label: '✏️ กำหนดเอง' },
            { value: 'solo' as const, label: '🙋 คนเดียว' },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setSplitMode(opt.value)}
              className={cn(
                'min-w-[80px] flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-all sm:whitespace-nowrap',
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
              เลือกคนที่หารด้วย ({equalIncluded.size} คน → คนละ {currencySymbol}
              {equalShareAmount.toFixed(0)})
            </p>
            <div className="flex flex-wrap gap-2">
              {members.map((m) => {
                const on = equalIncluded.has(m.personId)
                return (
                  <button
                    key={m.personId}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      const next = new Set(equalIncluded)
                      if (on) next.delete(m.personId)
                      else next.add(m.personId)
                      setEqualIncluded(next)
                    }}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition-all',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {m.displayName}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {splitMode === 'custom' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              กรอกจำนวนของแต่ละคนที่จ่าย (รวม: {currencySymbol}{customTotal.toFixed(0)} / {currencySymbol}{total.toFixed(0)})
            </p>
            {payerParticipants.map((p) => (
              <div key={p.personId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm">{p.displayName}</span>
                <div className="relative w-28 shrink-0">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    className="pl-6"
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
