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
import { AddContactInline } from '@/components/friends/add-contact-inline'
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
  /** Split among every member by default (trips); otherwise only the payers start included */
  defaultIncludeAll?: boolean
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
  return c.isSelf ? ME_PERSON_ID : c.key
}

function resolveMemberPersonId(
  userId: string,
  displayName: string,
  members: SplitMember[],
  mePersonId: string = ME_PERSON_ID
): string {
  if (userId === ME_PERSON_ID || userId === 'Me') {
    if (mePersonId && members.some((m) => m.personId === mePersonId)) {
      return mePersonId
    }
    // Legacy trips store the current user as "Me" even when previewPersonId is a Firebase uid.
    const meInMembers = members.find(
      (m) => m.personId === ME_PERSON_ID || m.personId === 'Me'
    )
    if (meInMembers) return meInMembers.personId
    return mePersonId || ME_PERSON_ID
  }
  if (members.some((m) => m.personId === userId)) return userId
  const byName = members.find(
    (m) => m.displayName === userId || m.displayName === displayName
  )
  if (byName) return byName.personId
  return userId
}

function defaultPayerFromMembers(
  members: SplitMember[],
  mePersonId: string
): PayerRow {
  const me =
    members.find((m) => m.personId === mePersonId) ||
    members.find((m) => m.personId === ME_PERSON_ID) ||
    members[0]
  if (me) {
    return {
      personId: me.personId,
      displayName: me.displayName,
      amount: '',
    }
  }
  return { personId: mePersonId || ME_PERSON_ID, displayName: 'Me', amount: '' }
}

const SPLIT_MODES: { value: TransactionSplitMode; label: string }[] = [
  { value: 'equal', label: 'หารเท่ากัน' },
  { value: 'custom', label: 'กำหนดเอง' },
  { value: 'solo', label: 'ไม่หาร' },
]

export function TransactionSplitSection({
  total,
  initialPayers,
  initialShares,
  initialSplitMode,
  members: membersProp,
  defaultIncludeAll = false,
  currencySymbol = '฿',
  previewPersonId = ME_PERSON_ID,
  hideSplitOptions = false,
  useEffectivePayerAmounts = false,
  embedded = false,
  disabled,
  onChange,
}: TransactionSplitSectionProps) {
  const { contacts, loading: friendsLoading } = useFriends()
  const mePersonId = previewPersonId || ME_PERSON_ID

  const contactKey = contacts.map((c) => `${c.key}:${c.displayName}`).join('|')
  const membersFromFriends = React.useMemo(() => {
    const seen = new Set<string>()
    const list: SplitMember[] = []
    for (const c of contacts) {
      const personId = contactPersonId(c)
      if (seen.has(personId)) continue
      seen.add(personId)
      list.push({ personId, displayName: c.isSelf ? 'ฉัน' : c.displayName })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey])

  const members = React.useMemo(() => {
    const base = membersProp ?? membersFromFriends
    const byId = new Map(base.map((m) => [m.personId, m]))
    const addOrphan = (userId: string, displayName: string) => {
      const resolved = resolveMemberPersonId(userId, displayName, base, mePersonId)
      if (byId.has(resolved)) return
      byId.set(resolved, {
        personId: resolved,
        displayName: displayName || userId,
      })
    }
    for (const p of initialPayers ?? []) addOrphan(p.userId, p.displayName)
    for (const s of initialShares ?? []) addOrphan(s.userId, s.displayName)
    return Array.from(byId.values()).filter((m) => m.personId.trim() !== '')
  }, [membersProp, membersFromFriends, initialPayers, initialShares, mePersonId])

  const loading = membersProp ? false : friendsLoading
  const hasInitialShares = Boolean(initialShares?.length)

  const [splitMode, setSplitMode] = React.useState<TransactionSplitMode>(
    initialSplitMode || 'equal'
  )

  const [payers, setPayers] = React.useState<PayerRow[]>(() => {
    const memberList = membersProp ?? []
    if (initialPayers?.length) {
      return initialPayers.map((p) => {
        const personId = resolveMemberPersonId(
          p.userId,
          p.displayName,
          memberList,
          mePersonId
        )
        const member = memberList.find((m) => m.personId === personId)
        return {
          personId,
          displayName: member?.displayName || p.displayName,
          amount: String(p.amount),
        }
      })
    }
    return [defaultPayerFromMembers(memberList, mePersonId)]
  })

  /** People who share the cost — independent of who paid. */
  const [included, setIncluded] = React.useState<Set<string>>(() => {
    const memberList = membersProp ?? []
    if (initialShares?.length && initialSplitMode !== 'solo') {
      return new Set(
        initialShares.map((s) =>
          resolveMemberPersonId(s.userId, s.displayName, memberList, mePersonId)
        )
      )
    }
    if (defaultIncludeAll && memberList.length > 0) {
      return new Set(memberList.map((m) => m.personId))
    }
    if (initialPayers?.length) {
      return new Set(
        initialPayers.map((p) =>
          resolveMemberPersonId(p.userId, p.displayName, memberList, mePersonId)
        )
      )
    }
    return new Set([defaultPayerFromMembers(memberList, mePersonId).personId])
  })
  const includedTouchedRef = React.useRef(hasInitialShares)

  const [customShares, setCustomShares] = React.useState<Record<string, string>>(() => {
    if (initialShares?.length && initialSplitMode === 'custom') {
      const memberList = membersProp ?? []
      return Object.fromEntries(
        initialShares.map((s) => [
          resolveMemberPersonId(s.userId, s.displayName, memberList, mePersonId),
          String(s.amount),
        ])
      )
    }
    return {}
  })

  // When trip members arrive / mePersonId is a real UID, remap legacy "Me" rows.
  React.useEffect(() => {
    if (!members.length) return
    setPayers((prev) => {
      let changed = false
      const next = prev.map((p) => {
        const resolved = resolveMemberPersonId(p.personId, p.displayName, members, mePersonId)
        if (resolved === p.personId) return p
        changed = true
        const member = members.find((m) => m.personId === resolved)
        return {
          ...p,
          personId: resolved,
          displayName: member?.displayName || p.displayName,
        }
      })
      return changed ? next : prev
    })
    setIncluded((prev) => {
      if (defaultIncludeAll && !includedTouchedRef.current) {
        const all = new Set(members.map((m) => m.personId))
        const same = all.size === prev.size && [...all].every((id) => prev.has(id))
        return same ? prev : all
      }
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        const resolved = resolveMemberPersonId(id, id, members, mePersonId)
        if (resolved !== id) changed = true
        next.add(resolved)
      }
      if (next.size === 0) {
        next.add(defaultPayerFromMembers(members, mePersonId).personId)
        changed = true
      }
      return changed ? next : prev
    })
  }, [members, mePersonId, defaultIncludeAll])

  const payerIdsKey = payers.map((p) => p.personId).join('|')
  const seenPayerIdsRef = React.useRef<Set<string>>(new Set(payers.map((p) => p.personId)))

  // A newly added payer usually shares the cost too; removing a payer never removes a sharer.
  React.useEffect(() => {
    const fresh = payers.map((p) => p.personId).filter((id) => id && !seenPayerIdsRef.current.has(id))
    for (const id of payers.map((p) => p.personId)) seenPayerIdsRef.current.add(id)
    if (fresh.length === 0) return
    setIncluded((prev) => {
      const next = new Set(prev)
      for (const id of fresh) next.add(id)
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payerIdsKey])

  const participants = React.useMemo(() => {
    const list: SplitMember[] = members.filter((m) => included.has(m.personId))
    for (const id of included) {
      if (list.some((m) => m.personId === id)) continue
      const payer = payers.find((p) => p.personId === id)
      list.push({ personId: id, displayName: payer?.displayName || id })
    }
    return list
  }, [members, included, payers])

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
        initialPayers.map((p) => {
          const personId = resolveMemberPersonId(p.userId, p.displayName, members, mePersonId)
          const member = members.find((m) => m.personId === personId)
          return {
            personId,
            displayName: member?.displayName || p.displayName,
            amount: String(p.amount),
          }
        })
      )
    }
    if (initialSplitMode) setSplitMode(initialSplitMode)
    if (initialShares?.length && initialSplitMode !== 'solo') {
      const ids = initialShares.map((s) =>
        resolveMemberPersonId(s.userId, s.displayName, members, mePersonId)
      )
      setIncluded(new Set(ids))
      if (initialSplitMode === 'custom') {
        setCustomShares(
          Object.fromEntries(
            initialShares.map((s, i) => [ids[i], String(s.amount)])
          )
        )
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSplitKey, members, mePersonId])

  const toggleIncluded = (personId: string) => {
    includedTouchedRef.current = true
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(personId)) {
        if (next.size === 1) return prev
        next.delete(personId)
      } else {
        next.add(personId)
      }
      return next
    })
  }

  const addPayer = () => {
    const used = new Set(payers.map((p) => p.personId))
    const next = members.find((m) => m.personId && !used.has(m.personId))
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
  const equalShareAmount = participants.length > 0 ? total / participants.length : 0
  const customTotal = participants.reduce(
    (s, p) => s + (parseFloat(customShares[p.personId] ?? '') || 0),
    0
  )

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

    if (splitMode === 'solo' || hideSplitOptions) {
      finalShares = finalPayers.map((p) => ({
        userId: p.userId,
        displayName: p.displayName,
        amount: p.amount,
      }))
    } else if (splitMode === 'equal') {
      if (participants.length === 0) {
        errs.push('เลือกคนที่หารอย่างน้อย 1 คน')
      } else {
        const share = parseFloat((total / participants.length).toFixed(2))
        finalShares = participants.map((p) => ({
          userId: p.personId,
          displayName: p.displayName,
          amount: share,
        }))
      }
    } else {
      finalShares = participants
        .filter((p) => parseFloat(customShares[p.personId] ?? '') > 0)
        .map((p) => ({
          userId: p.personId,
          displayName: p.displayName,
          amount: parseFloat(customShares[p.personId]),
        }))
      if (Math.abs(customTotal - total) > 1) {
        errs.push(`ยอดที่แต่ละคนออก (${currencySymbol}${customTotal.toFixed(0)}) ไม่ตรงกับยอดรวม (${currencySymbol}${total.toFixed(0)})`)
      }
    }

    return { payers: finalPayers, shares: finalShares, splitMode, errors: errs }
  }, [
    total,
    payers,
    lastPayerSuggestion,
    splitMode,
    hideSplitOptions,
    participants,
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
    return <p className="text-sm text-muted-foreground">กำลังโหลดรายชื่อ…</p>
  }

  const nameOf = (personId: string) =>
    personId === previewPersonId
      ? 'คุณ'
      : members.find((m) => m.personId === personId)?.displayName || personId

  const onlyMe = !membersProp && members.length <= 1

  return (
    <div
      className={cn(
        embedded ? 'space-y-4' : 'space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4'
      )}
    >
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">ใครจ่ายไปก่อน</Label>
          {payers.length < members.length && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPayer}
              disabled={disabled}
              className="h-9 shrink-0 gap-1 px-2 text-xs"
            >
              <Plus className="size-3.5" aria-hidden /> เพิ่มคนจ่าย
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {payers.map((payer, idx) => {
            const selectValue = members.some((m) => m.personId === payer.personId)
              ? payer.personId
              : members[0]?.personId
            return (
            <div key={`${payer.personId}-${idx}`} className="space-y-0.5">
              <div className="grid grid-cols-[1fr_6rem_2.25rem] items-center gap-1.5 sm:gap-2">
                <Select
                  value={selectValue || undefined}
                  onValueChange={(v) => updatePayerPerson(idx, v)}
                  disabled={disabled || !selectValue}
                >
                  <SelectTrigger className="h-9 min-w-0 text-sm" aria-label={`คนจ่ายคนที่ ${idx + 1}`}>
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
                  <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="h-9 pl-6 text-sm tabular-nums"
                    disabled={disabled}
                    aria-label={`ยอดที่ ${payer.displayName} จ่าย`}
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
                    className="size-9 shrink-0"
                    disabled={disabled}
                    aria-label={`เอา ${payer.displayName} ออกจากคนจ่าย`}
                    onClick={() => removePayer(idx)}
                  >
                    <Minus className="size-3.5" aria-hidden />
                  </Button>
                ) : (
                  <div className="size-9 shrink-0" />
                )}
              </div>
              {useEffectivePayerAmounts && parseFloat(payer.amount) > 0 && (
                <p className="text-xs text-muted-foreground tabular-nums pl-0.5">
                  จ่ายจริง {currencySymbol}
                  {toPaotangEffectivePayerAmount(parseFloat(payer.amount) || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 2,
                  })}
                </p>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {!hideSplitOptions && (
      <div className="space-y-2">
        <Label className="text-sm" id="split-mode-label">หารยังไง</Label>
        <div role="group" aria-labelledby="split-mode-label" className="grid grid-cols-3 gap-1.5">
          {SPLIT_MODES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-pressed={splitMode === opt.value}
              onClick={() => setSplitMode(opt.value)}
              className={cn(
                'h-9 rounded-lg border px-2 text-xs font-medium transition-colors sm:text-sm',
                splitMode === opt.value
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:border-primary/50'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {splitMode !== 'solo' && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground" id="split-with-label">
              {splitMode === 'equal'
                ? `หารกับใคร · ${participants.length} คน คนละ ${currencySymbol}${equalShareAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                : 'หารกับใคร · แตะชื่อเพื่อเลือก แล้วใส่ยอดของแต่ละคน'}
            </p>
            <div role="group" aria-labelledby="split-with-label" className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const on = included.has(m.personId)
                const isLastSelected = on && included.size === 1
                return (
                  <button
                    key={m.personId}
                    type="button"
                    aria-pressed={on}
                    disabled={disabled || isLastSelected}
                    onClick={() => toggleIncluded(m.personId)}
                    className={cn(
                      'min-h-9 rounded-full border px-3 text-sm font-medium transition-colors',
                      on
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground'
                    )}
                  >
                    {m.displayName}
                  </button>
                )
              })}
            </div>
            {!membersProp && (
              <AddContactInline
                disabled={disabled}
                label={onlyMe ? 'ยังไม่มีรายชื่อเพื่อน — เพิ่มคนที่หารด้วย' : 'เพิ่มรายชื่อใหม่'}
                onAdded={({ key }) => {
                  includedTouchedRef.current = true
                  setIncluded((prev) => new Set(prev).add(key))
                }}
              />
            )}

            {splitMode === 'custom' && (
              <div className="space-y-2 pt-1">
                {participants.map((p) => (
                  <div key={p.personId} className="grid grid-cols-[1fr_6rem] items-center gap-2">
                    <Label htmlFor={`share-${p.personId}`} className="min-w-0 truncate text-sm font-normal">
                      {p.displayName}
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {currencySymbol}
                      </span>
                      <Input
                        id={`share-${p.personId}`}
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        className="h-9 pl-6 text-sm tabular-nums"
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
                <p className="text-xs text-muted-foreground tabular-nums">
                  รวม {currencySymbol}{customTotal.toLocaleString()} / {currencySymbol}{total.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        )}

        {splitMode === 'solo' && (
          <p className="text-xs text-muted-foreground">คนที่จ่ายออกเองทั้งหมด ไม่มีใครติดใคร</p>
        )}
      </div>
      )}

      {errors.length > 0 && (
        <div role="alert" className="space-y-1 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          {errors.map((e, i) => (
            <p key={i}>{e}</p>
          ))}
        </div>
      )}

      {preview && preview.length > 0 && total > 0 && (
        <div className="space-y-1 rounded-lg bg-muted p-3 text-sm">
          <p className="font-medium">ผลลัพธ์</p>
          {preview.map((t, i) => (
            <p key={i} className="text-muted-foreground">
              {nameOf(t.from)} ต้องคืน {nameOf(t.to)}{' '}
              <span className="font-medium text-foreground tabular-nums">
                {currencySymbol}{t.amount.toLocaleString()}
              </span>
            </p>
          ))}
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
    errs.push(`ยอดที่หารไม่ตรงกับยอดรวม`)
  }
  return errs
}
