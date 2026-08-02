'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFriends, type Contact } from '@/hooks/use-friends'

const NONE_VALUE = '__none__'
const ME_VALUE = 'me'

interface ContactSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Show empty option — maps to empty string */
  allowNone?: boolean
  /** Label for the empty option when allowNone is true */
  noneLabel?: string
  /** Hide "Me" option (e.g. for Split With) */
  includeMe?: boolean
}

type SelectOption = {
  key: string
  displayName: string
  isSelf?: boolean
  isCustom?: boolean
  aliases?: string[]
}

/** Stable SelectItem value — must not change when friends finish loading. */
function optionSelectValue(c: SelectOption): string {
  if (c.isSelf) return ME_VALUE
  return c.displayName
}

function matchesContact(stored: string, c: Contact): boolean {
  if (!stored) return false
  if (c.isSelf) return stored === 'Me' || stored === ME_VALUE
  if (c.key === stored || c.displayName === stored) return true
  return Boolean(c.aliases?.some((a) => a === stored))
}

export function ContactSelect({
  value,
  onChange,
  placeholder = 'เลือกรายชื่อ',
  allowNone = false,
  noneLabel = 'ไม่แบ่ง',
  includeMe = true,
}: ContactSelectProps) {
  const { contacts, loading } = useFriends()
  // Track user-opened menu so remount clears to ไม่ระบุ are ignored.
  const userOpenedRef = React.useRef(false)

  const options = contacts.filter((c) => includeMe || !c.isSelf)
  const matched = value ? options.find((c) => matchesContact(value, c)) : undefined

  const orphan: SelectOption | null =
    value && !matched && value !== 'Me' && value !== ME_VALUE
      ? { key: `orphan:${value}`, displayName: value }
      : null

  const allOptions = React.useMemo(() => {
    const seen = new Set<string>()
    const list: SelectOption[] = []
    for (const c of [...options, ...(orphan ? [orphan] : [])]) {
      const sv = optionSelectValue(c)
      if (seen.has(sv)) continue
      seen.add(sv)
      list.push(c)
    }
    return list
  }, [options, orphan])

  const selectValue = React.useMemo(() => {
    if (allowNone && !value) return NONE_VALUE
    if (!value) return includeMe ? ME_VALUE : NONE_VALUE
    if (value === 'Me' || value === ME_VALUE) {
      if (includeMe) return ME_VALUE
      // Received From hides Me — keep a stable orphan value so Radix does not clear
      return allowNone ? NONE_VALUE : 'Me'
    }
    // Prefer canonical displayName so alias-stored values still highlight the contact
    if (matched && !matched.isSelf) return matched.displayName
    if (matched?.isSelf) return ME_VALUE
    return value
  }, [allowNone, includeMe, matched, value])

  const handleChange = (v: string) => {
    // Radix can emit empty when SelectItems remount (friends loading). Ignore that.
    if (!v) return
    if (v === NONE_VALUE) {
      if (!userOpenedRef.current && value) return
      userOpenedRef.current = false
      onChange('')
      return
    }
    userOpenedRef.current = false
    if (v === ME_VALUE) {
      onChange('Me')
      return
    }
    onChange(v)
  }

  // If Me is stored but Me is hidden, still render a selectable row so the label shows
  const showMeOrphan =
    !includeMe &&
    !allowNone &&
    (value === 'Me' || value === ME_VALUE) &&
    !allOptions.some((c) => c.isSelf)

  return (
    <Select
      value={selectValue}
      onValueChange={handleChange}
      onOpenChange={(next) => {
        if (next) userOpenedRef.current = true
      }}
      disabled={loading && allOptions.length === 0 && !value}
    >
      <SelectTrigger aria-busy={loading} aria-label={placeholder}>
        <SelectValue placeholder={loading ? 'กำลังโหลด...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
        )}
        {showMeOrphan && <SelectItem value="Me">Me</SelectItem>}
        {allOptions.map((c) => (
          <SelectItem key={c.key} value={optionSelectValue(c)}>
            {c.displayName}
            {c.isSelf
              ? ' (ฉัน)'
              : c.isCustom
                ? ' (รายชื่อส่วนตัว)'
                : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
