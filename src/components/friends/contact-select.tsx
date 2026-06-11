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
  /** Show "ไม่แบ่ง" option — maps to empty string */
  allowNone?: boolean
  /** Hide "Me" option (e.g. for Split With) */
  includeMe?: boolean
}

export function ContactSelect({
  value,
  onChange,
  placeholder = 'เลือกรายชื่อ',
  allowNone = false,
  includeMe = true,
}: ContactSelectProps) {
  const { contacts, loading } = useFriends()

  const options = contacts.filter(c => includeMe || !c.isSelf)
  const knownNames = new Set(options.map(c => c.displayName))
  const extraOptions =
    value && !knownNames.has(value) && value !== 'Me'
      ? [{ key: `legacy:${value}`, displayName: value }]
      : []
  const allOptions = [...options, ...extraOptions]
  const selectValue = allowNone && !value ? NONE_VALUE : (value || 'Me')

  const handleChange = (v: string) => {
    onChange(v === NONE_VALUE ? '' : v)
  }

  return (
    <Select value={selectValue} onValueChange={handleChange} disabled={loading}>
      <SelectTrigger>
        <SelectValue placeholder={loading ? 'กำลังโหลด...' : placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowNone && (
          <SelectItem value={NONE_VALUE}>ไม่แบ่ง</SelectItem>
        )}
        {allOptions.map((c) => (
          <SelectItem key={c.key} value={c.displayName}>
            {c.displayName}
            {'isSelf' in c && c.isSelf ? ' (ฉัน)' : 'isCustom' in c && c.isCustom ? ' (รายชื่อเอง)' : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
