'use client'

import * as React from 'react'
import { Plus, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { intlLocale, pickClient } from '@/lib/i18n'
import { useLocale } from '@/components/locale-provider'
import { useFriends, type Contact } from '@/hooks/use-friends'
import { AddContactInline } from '@/components/friends/add-contact-inline'
import { MoneyInput } from '@/components/shared/money-input'
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
  /** Put every member on the bill by default (trips); otherwise only the payer starts on it */
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

type SplitState = {
  payers: PayerRow[]
  included: Set<string>
  splitMode: TransactionSplitMode
  customShares: Record<string, string>
}

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

/**
 * Everyone on the bill = sharers ∪ payers. An "equal" split whose payer did not
 * share would change amounts once the payer joins the bill, so it opens as custom.
 */
function deriveInitialState(
  memberList: SplitMember[],
  mePersonId: string,
  defaultIncludeAll: boolean,
  initialPayers: TripExpensePayer[] | undefined,
  initialShares: TripExpenseShare[] | undefined,
  initialSplitMode: TransactionSplitMode | undefined
): SplitState {
  const payers: PayerRow[] = initialPayers?.length
    ? initialPayers.map((p) => {
        const personId = resolveMemberPersonId(p.userId, p.displayName, memberList, mePersonId)
        const member = memberList.find((m) => m.personId === personId)
        return {
          personId,
          displayName: member?.displayName || p.displayName,
          amount: String(p.amount),
        }
      })
    : [defaultPayerFromMembers(memberList, mePersonId)]

  let splitMode: TransactionSplitMode = initialSplitMode || 'equal'
  let customShares: Record<string, string> = {}
  const included = new Set<string>()

  if (initialShares?.length && splitMode !== 'solo') {
    const shareIds = initialShares.map((s) =>
      resolveMemberPersonId(s.userId, s.displayName, memberList, mePersonId)
    )
    shareIds.forEach((id) => included.add(id))
    const payerOutsideShares = payers.some((p) => !included.has(p.personId))
    if (splitMode === 'custom' || payerOutsideShares) {
      splitMode = 'custom'
      customShares = Object.fromEntries(
        initialShares.map((s, i) => [shareIds[i], String(s.amount)])
      )
    }
  } else if (defaultIncludeAll && memberList.length > 0) {
    memberList.forEach((m) => included.add(m.personId))
  }
  payers.forEach((p) => included.add(p.personId))

  return { payers, included, splitMode, customShares }
}

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
  const { p, locale } = useLocale()
  const idBase = React.useId()
  const peopleLabelId = `${idBase}-people`
  const modeLabelId = `${idBase}-mode`
  const { contacts, loading: friendsLoading } = useFriends()
  const mePersonId = previewPersonId || ME_PERSON_ID
  const meLabel = p({ th: 'ฉัน', en: 'Me', zh: '我' })

  const contactKey = contacts.map((c) => `${c.key}:${c.displayName}`).join('|')
  const membersFromFriends = React.useMemo(() => {
    const seen = new Set<string>()
    const list: SplitMember[] = []
    for (const c of contacts) {
      const personId = contactPersonId(c)
      if (seen.has(personId)) continue
      seen.add(personId)
      list.push({ personId, displayName: c.isSelf ? meLabel : c.displayName })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactKey, meLabel])

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
    for (const payer of initialPayers ?? []) addOrphan(payer.userId, payer.displayName)
    for (const s of initialShares ?? []) addOrphan(s.userId, s.displayName)
    return Array.from(byId.values()).filter((m) => m.personId.trim() !== '')
  }, [membersProp, membersFromFriends, initialPayers, initialShares, mePersonId])

  const loading = membersProp ? false : friendsLoading
  const hasInitialShares = Boolean(initialShares?.length)

  const [initialState] = React.useState(() =>
    deriveInitialState(
      membersProp ?? [],
      mePersonId,
      defaultIncludeAll,
      initialPayers,
      initialShares,
      initialSplitMode
    )
  )
  const [splitMode, setSplitMode] = React.useState<TransactionSplitMode>(initialState.splitMode)
  const [payers, setPayers] = React.useState<PayerRow[]>(initialState.payers)
  /** Everyone on this bill. Payers are always on it; the cost is split among them. */
  const [included, setIncluded] = React.useState<Set<string>>(initialState.included)
  const [customShares, setCustomShares] = React.useState<Record<string, string>>(
    initialState.customShares
  )
  const includedTouchedRef = React.useRef(hasInitialShares)

  // When trip members arrive / mePersonId is a real UID, remap legacy "Me" rows.
  React.useEffect(() => {
    if (!members.length) return
    setPayers((prev) => {
      let changed = false
      const next = prev.map((row) => {
        const resolved = resolveMemberPersonId(row.personId, row.displayName, members, mePersonId)
        if (resolved === row.personId) return row
        changed = true
        const member = members.find((m) => m.personId === resolved)
        return {
          ...row,
          personId: resolved,
          displayName: member?.displayName || row.displayName,
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

  const participants = React.useMemo(() => {
    const list: SplitMember[] = members.filter((m) => included.has(m.personId))
    for (const id of included) {
      if (list.some((m) => m.personId === id)) continue
      const payer = payers.find((row) => row.personId === id)
      list.push({ personId: id, displayName: payer?.displayName || id })
    }
    return list
  }, [members, included, payers])

  /** Itemised trip receipts have no "who's on the bill" step, so any member can pay. */
  const payerChoices = hideSplitOptions ? members : participants

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
    if (!initialPayers?.length && !initialShares?.length && !initialSplitMode) return
    const next = deriveInitialState(
      members,
      mePersonId,
      defaultIncludeAll,
      initialPayers,
      initialShares,
      initialSplitMode
    )
    if (initialPayers?.length) setPayers(next.payers)
    if (initialSplitMode) setSplitMode(next.splitMode)
    if (initialShares?.length && initialSplitMode !== 'solo') {
      setIncluded(next.included)
      setCustomShares(next.customShares)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSplitKey, members, mePersonId])

  const toggleIncluded = (personId: string) => {
    includedTouchedRef.current = true
    if (!included.has(personId)) {
      setIncluded(new Set(included).add(personId))
      return
    }
    if (included.size === 1) return
    const next = new Set(included)
    next.delete(personId)
    setIncluded(next)
    if (hideSplitOptions || !payers.some((row) => row.personId === personId)) return
    const remaining = payers.filter((row) => row.personId !== personId)
    if (remaining.length > 0) {
      setPayers(remaining)
      return
    }
    const fallbackId = [...next][0]
    const fallback = members.find((m) => m.personId === fallbackId)
    setPayers([
      {
        personId: fallbackId,
        displayName: fallback?.displayName || fallbackId,
        amount: payers[0]?.amount ?? '',
      },
    ])
  }

  const addPayer = () => {
    const used = new Set(payers.map((row) => row.personId))
    const next = payerChoices.find((m) => m.personId && !used.has(m.personId))
    if (!next) return
    setPayers([...payers, { personId: next.personId, displayName: next.displayName, amount: '' }])
  }

  const removePayer = (idx: number) => {
    if (payers.length <= 1) return
    setPayers(payers.filter((_, i) => i !== idx))
  }

  const updatePayerPerson = (idx: number, personId: string) => {
    const member = payerChoices.find((m) => m.personId === personId)
    if (!member) return
    setPayers(payers.map((row, i) => (i === idx ? { ...row, personId, displayName: member.displayName } : row)))
  }

  const updatePayerAmount = (idx: number, val: string) => {
    setPayers(payers.map((row, i) => (i === idx ? { ...row, amount: val } : row)))
  }

  const totalPaid = payers.slice(0, -1).reduce((s, row) => s + (parseFloat(row.amount) || 0), 0)
  const lastPayerSuggestion = Math.max(0, total - totalPaid)
  const equalShareAmount = participants.length > 0 ? total / participants.length : 0
  const customTotal = participants.reduce(
    (s, person) => s + (parseFloat(customShares[person.personId] ?? '') || 0),
    0
  )
  const money = (n: number) =>
    `${currencySymbol}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`

  const buildResult = React.useMemo((): {
    payers: TripExpensePayer[]
    shares: TripExpenseShare[]
    splitMode: TransactionSplitMode
    errors: string[]
  } | null => {
    if (!total || total <= 0) return null

    const errs: string[] = []
    const finalPayers: TripExpensePayer[] = payers.map((row, i) => ({
      userId: row.personId,
      displayName: row.displayName,
      amount:
        i === payers.length - 1 && !row.amount
          ? parseFloat(lastPayerSuggestion.toFixed(2))
          : parseFloat(row.amount) || 0,
    }))

    const paidTotal = finalPayers.reduce((s, row) => s + row.amount, 0)
    if (Math.abs(paidTotal - total) > 1) {
      const paid = `${currencySymbol}${paidTotal.toFixed(0)}`
      const sum = `${currencySymbol}${total.toFixed(0)}`
      errs.push(
        p({
          th: `ยอดที่จ่าย (${paid}) ไม่ตรงกับยอดรวม (${sum})`,
          en: `Amount paid (${paid}) doesn't match the total (${sum})`,
          zh: `已付金额（${paid}）与总额（${sum}）不一致`,
        })
      )
    }

    let finalShares: TripExpenseShare[] = []

    if (splitMode === 'solo' || hideSplitOptions) {
      finalShares = finalPayers.map((row) => ({
        userId: row.userId,
        displayName: row.displayName,
        amount: row.amount,
      }))
    } else if (splitMode === 'equal') {
      if (participants.length === 0) {
        errs.push(
          p({
            th: 'เลือกคนในบิลอย่างน้อย 1 คน',
            en: 'Pick at least one person on this bill',
            zh: '请至少选择 1 位账单成员',
          })
        )
      } else {
        const share = parseFloat((total / participants.length).toFixed(2))
        finalShares = participants.map((person) => ({
          userId: person.personId,
          displayName: person.displayName,
          amount: share,
        }))
      }
    } else {
      finalShares = participants
        .filter((person) => parseFloat(customShares[person.personId] ?? '') > 0)
        .map((person) => ({
          userId: person.personId,
          displayName: person.displayName,
          amount: parseFloat(customShares[person.personId]),
        }))
      if (Math.abs(customTotal - total) > 1) {
        const shared = `${currencySymbol}${customTotal.toFixed(0)}`
        const sum = `${currencySymbol}${total.toFixed(0)}`
        errs.push(
          p({
            th: `ยอดที่แต่ละคนออก (${shared}) ไม่ตรงกับยอดรวม (${sum})`,
            en: `Shares (${shared}) don't add up to the total (${sum})`,
            zh: `各人分摊（${shared}）与总额（${sum}）不一致`,
          })
        )
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
    p,
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
      ? buildResult.payers.map((row) => ({
          ...row,
          amount: toPaotangEffectivePayerAmount(row.amount),
        }))
      : buildResult.payers
    const net = computeSplitNetBalances(payersForPreview, buildResult.shares)
    return computeSplitTransfers(net).filter(
      (t) => t.from === previewPersonId || t.to === previewPersonId
    )
  }, [buildResult, total, previewPersonId, useEffectivePayerAmounts])

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground">
        {p({ th: 'กำลังโหลดรายชื่อ…', en: 'Loading contacts…', zh: '正在加载联系人…' })}
      </p>
    )
  }

  const nameOf = (personId: string) =>
    personId === previewPersonId
      ? p({ th: 'คุณ', en: 'You', zh: '你' })
      : members.find((m) => m.personId === personId)?.displayName || personId

  const onlyMe = !membersProp && members.length <= 1
  const splitModes: { value: TransactionSplitMode; label: string }[] = [
    { value: 'equal', label: p({ th: 'หารเท่ากัน', en: 'Split equally', zh: '平均分摊' }) },
    { value: 'custom', label: p({ th: 'กำหนดเอง', en: 'Custom', zh: '自定义' }) },
    { value: 'solo', label: p({ th: 'ไม่หาร', en: "Don't split", zh: '不分摊' }) },
  ]
  const peopleCount = p({
    th: `${participants.length} คน`,
    en: `${participants.length} ${participants.length === 1 ? 'person' : 'people'}`,
    zh: `${participants.length} 人`,
  })
  const amountFmt = (n: number) =>
    n.toLocaleString(intlLocale(locale), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })

  return (
    <div
      className={cn(
        embedded ? 'space-y-4' : 'space-y-4 rounded-lg border bg-muted/20 p-3 sm:p-4'
      )}
    >
      {!hideSplitOptions && (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="text-sm" id={peopleLabelId}>
              {p({ th: 'ใครอยู่ในบิลนี้บ้าง', en: "Who's on this bill?", zh: '这笔账单有谁？' })}
            </Label>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{peopleCount}</span>
          </div>
          <div role="group" aria-labelledby={peopleLabelId} className="flex flex-wrap gap-1.5">
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
                    'min-h-9 max-w-full truncate rounded-full border px-3 text-sm font-medium transition-colors',
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
              label={
                onlyMe
                  ? p({
                      th: 'ยังไม่มีรายชื่อเพื่อน — เพิ่มคนในบิลนี้',
                      en: 'No friends yet — add someone to this bill',
                      zh: '还没有好友 — 添加账单成员',
                    })
                  : p({ th: 'เพิ่มรายชื่อใหม่', en: 'Add new person', zh: '添加新联系人' })
              }
              onAdded={({ key }) => {
                includedTouchedRef.current = true
                setIncluded((prev) => new Set(prev).add(key))
              }}
            />
          )}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label className="text-sm">
            {p({ th: 'ใครจ่ายไปก่อน', en: 'Who paid?', zh: '谁先付的？' })}
          </Label>
          {payers.length < payerChoices.length && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addPayer}
              disabled={disabled}
              className="h-9 shrink-0 gap-1 px-2 text-xs"
            >
              <Plus className="size-3.5" aria-hidden />
              {p({ th: 'เพิ่มคนจ่าย', en: 'Add payer', zh: '添加付款人' })}
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {payers.map((payer, idx) => {
            const selectValue = payerChoices.some((m) => m.personId === payer.personId)
              ? payer.personId
              : payerChoices[0]?.personId
            return (
            <div key={`${payer.personId}-${idx}`} className="space-y-0.5">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)_2.25rem] items-center gap-1.5 sm:gap-2">
                <Select
                  value={selectValue || undefined}
                  onValueChange={(v) => updatePayerPerson(idx, v)}
                  disabled={disabled || !selectValue}
                >
                  <SelectTrigger
                    className="h-9 w-full min-w-0 text-sm"
                    aria-label={p({
                      th: `คนจ่ายคนที่ ${idx + 1}`,
                      en: `Payer ${idx + 1}`,
                      zh: `付款人 ${idx + 1}`,
                    })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {payerChoices.map((m) => (
                      <SelectItem
                        key={m.personId}
                        value={m.personId}
                        disabled={payers.some((row, i) => i !== idx && row.personId === m.personId)}
                      >
                        {m.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <MoneyInput
                  currencySymbol={currencySymbol}
                  step="0.01"
                  className="h-9 text-base sm:text-sm"
                  disabled={disabled}
                  aria-label={p({
                    th: `ยอดที่ ${payer.displayName} จ่าย`,
                    en: `Amount ${payer.displayName} paid`,
                    zh: `${payer.displayName} 支付的金额`,
                  })}
                  placeholder={idx === payers.length - 1 ? String(lastPayerSuggestion.toFixed(0)) : '0'}
                  value={payer.amount}
                  onChange={(e) => updatePayerAmount(idx, e.target.value)}
                />
                {payers.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-9 shrink-0"
                    disabled={disabled}
                    aria-label={p({
                      th: `เอา ${payer.displayName} ออกจากคนจ่าย`,
                      en: `Remove ${payer.displayName} from payers`,
                      zh: `将 ${payer.displayName} 从付款人中移除`,
                    })}
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
                  {p({ th: 'จ่ายจริง', en: 'Actually paid', zh: '实付' })} {currencySymbol}
                  {amountFmt(toPaotangEffectivePayerAmount(parseFloat(payer.amount) || 0))}
                </p>
              )}
            </div>
            )
          })}
        </div>
      </div>

      {!hideSplitOptions && (
      <div className="space-y-2">
        <Label className="text-sm" id={modeLabelId}>
          {p({ th: 'หารยังไง', en: 'How to split', zh: '怎么分摊' })}
        </Label>
        <div role="group" aria-labelledby={modeLabelId} className="grid grid-cols-3 gap-1.5">
          {splitModes.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              aria-pressed={splitMode === opt.value}
              onClick={() => setSplitMode(opt.value)}
              className={cn(
                'min-h-9 rounded-lg border px-2 py-1 text-xs font-medium leading-tight transition-colors sm:text-sm',
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
          <p className="text-xs text-muted-foreground tabular-nums">
            {p({
              th: `หาร ${participants.length} คน คนละ ${money(equalShareAmount)}`,
              en: `${peopleCount}, ${money(equalShareAmount)} each`,
              zh: `${participants.length} 人平分，每人 ${money(equalShareAmount)}`,
            })}
          </p>
        )}

        {splitMode === 'custom' && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-muted-foreground">
              {p({
                th: 'ใส่ยอดที่แต่ละคนต้องออก',
                en: 'Enter how much each person owes',
                zh: '输入每个人应分摊的金额',
              })}
            </p>
            {participants.map((person) => (
              <div key={person.personId} className="grid grid-cols-[minmax(0,1fr)_minmax(6.5rem,8rem)] items-center gap-2">
                <Label htmlFor={`${idBase}-share-${person.personId}`} className="min-w-0 truncate text-sm font-normal">
                  {person.displayName}
                </Label>
                <MoneyInput
                  id={`${idBase}-share-${person.personId}`}
                  currencySymbol={currencySymbol}
                  step="0.01"
                  className="h-9 text-base sm:text-sm"
                  disabled={disabled}
                  placeholder="0"
                  value={customShares[person.personId] || ''}
                  onChange={(e) =>
                    setCustomShares({ ...customShares, [person.personId]: e.target.value })
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground tabular-nums">
              {p({ th: 'รวม', en: 'Total', zh: '合计' })} {money(customTotal)} / {money(total)}
            </p>
          </div>
        )}

        {splitMode === 'solo' && (
          <p className="text-xs text-muted-foreground">
            {p({
              th: 'คนที่จ่ายออกเองทั้งหมด ไม่มีใครติดใคร',
              en: 'Whoever paid covers it all — nobody owes anyone',
              zh: '付款人全额承担，无人欠款',
            })}
          </p>
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
          <p className="font-medium">{p({ th: 'ผลลัพธ์', en: 'Result', zh: '结果' })}</p>
          {preview.map((t, i) => (
            <p key={i} className="text-muted-foreground">
              {p({
                th: `${nameOf(t.from)} ต้องคืน ${nameOf(t.to)}`,
                en:
                  t.from === previewPersonId
                    ? `You owe ${nameOf(t.to)}`
                    : `${nameOf(t.from)} owes ${t.to === previewPersonId ? 'you' : nameOf(t.to)}`,
                zh: `${nameOf(t.from)} 需还给 ${nameOf(t.to)}`,
              })}{' '}
              <span className="whitespace-nowrap font-medium text-foreground tabular-nums">
                {money(t.amount)}
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
  const paidTotal = payers.reduce((s, row) => s + row.amount, 0)
  const shareTotal = shares.reduce((s, sh) => s + sh.amount, 0)
  if (Math.abs(paidTotal - total) > 1) {
    errs.push(
      pickClient({
        th: 'ยอดที่จ่ายไม่ตรงกับยอดรวม',
        en: "Amount paid doesn't match the total",
        zh: '已付金额与总额不一致',
      })
    )
  }
  if (Math.abs(shareTotal - total) > 1) {
    errs.push(
      pickClient({
        th: 'ยอดที่หารไม่ตรงกับยอดรวม',
        en: "Split amounts don't match the total",
        zh: '分摊金额与总额不一致',
      })
    )
  }
  return errs
}
