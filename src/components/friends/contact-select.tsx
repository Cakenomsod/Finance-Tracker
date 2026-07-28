'use client'

import * as React from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useFriends } from '@/hooks/use-friends'

const NONE_VALUE = '__none__'

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

export function ContactSelect({
  value,
  onChange,
  placeholder = 'เลือกรายชื่อ',
  allowNone = false,
  noneLabel = 'ไม่แบ่ง',
  includeMe = true,
}: ContactSelectProps) {
  const { contacts, loading } = useFriends()

  const options = contacts.filter(c => includeMe || !c.isSelf)
  const knownKeys = new Set(options.map(c => c.key))
  const knownNames = new Set(options.map(c => c.displayName))
  const extraOptions =
    value && !knownNames.has(value) && value !== 'Me' && !knownKeys.has(value)
      ? [{ key: `legacy:${value}`, displayName: value }]
      : []
  const allOptions = React.useMemo(() => {
    const seen = new Set<string>()
    const list: Array<{ key: string; displayName: string; isSelf?: boolean; isCustom?: boolean }> = []
    for (const c of [...options, ...extraOptions]) {
      if (seen.has(c.key)) continue
      seen.add(c.key)
      list.push(c)
    }
    return list
  }, [options, extraOptions])

  const resolveSelectKey = (name: string): string => {
    if (allowNone && !name) return NONE_VALUE
    const byKey = allOptions.find(c => c.key === name)
    if (byKey) return byKey.key
    const match = allOptions.find(c => c.displayName === name)
    if (match) return match.key
    if (name === 'Me') return 'me'
    if (name) return `legacy:${name}`
    return includeMe ? 'me' : NONE_VALUE
  }

  const selectValue = resolveSelectKey(value)

  const handleChange = (v: string) => {
    if (v === NONE_VALUE) {
      onChange('')
      return
    }
    const contact = allOptions.find(c => c.key === v)
    onChange(contact?.displayName ?? v.replace(/^legacy:/, ''))
  }

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger aria-busy={loading} aria-label={placeholder}>
        <SelectValue placeholder={loading ? 'กำลังโหลด...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>{noneLabel}</SelectItem>
        )}
        {allOptions.map((c) => (
          <SelectItem key={c.key} value={c.key}>
            {c.displayName}
            {'isSelf' in c && c.isSelf
              ? ' (ฉัน)'
              : 'isCustom' in c && c.isCustom
                ? ' (รายชื่อส่วนตัว)'
                : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
