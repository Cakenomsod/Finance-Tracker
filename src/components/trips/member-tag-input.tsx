'use client'

import * as React from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useLocale } from '@/components/locale-provider'

interface MemberTagInputProps {
  value: string[]
  onChange: (members: string[]) => void
  placeholder?: string
  className?: string
  disableMe?: boolean // if true, "Me" won't be auto-added
}

export function MemberTagInput({
  value,
  onChange,
  placeholder: placeholderProp,
  className,
  disableMe = false,
}: MemberTagInputProps) {
  const { p } = useLocale()
  const placeholder =
    placeholderProp ??
    p({ th: 'พิมพ์ชื่อแล้วกด Enter...', en: 'Type a name and press Enter…', zh: '输入名字后按回车…' })
  const [inputValue, setInputValue] = React.useState('')

  const addMember = (name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return
    if (value.some((m) => m.toLowerCase() === trimmed.toLowerCase())) return
    onChange([...value, trimmed])
    setInputValue('')
  }

  const removeMember = (name: string) => {
    onChange(value.filter((m) => m !== name))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addMember(inputValue)
    } else if (e.key === 'Backspace' && inputValue === '' && value.length > 0) {
      removeMember(value[value.length - 1])
    }
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap gap-2 min-h-[2.5rem] rounded-md border bg-background px-3 py-2 text-sm">
        {value.map((member) => (
          <Badge
            key={member}
            variant="secondary"
            className="flex items-center gap-1 pl-2 pr-1"
          >
            {member === 'Me' ? p({ th: 'ฉัน', en: 'Me', zh: '我' }) : member}
            <button
              type="button"
              onClick={() => removeMember(member)}
              aria-label={p({ th: `เอา ${member} ออก`, en: `Remove ${member}`, zh: `移除 ${member}` })}
              className="ml-1 rounded-full hover:bg-muted-foreground/20 p-0.5"
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            value.length === 0
              ? placeholder
              : p({ th: 'เพิ่มคนอื่น...', en: 'Add someone else…', zh: '添加其他人…' })
          }
          className="border-0 p-0 shadow-none focus-visible:ring-0 h-auto flex-1 min-w-[120px]"
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => addMember(inputValue || '')}
          disabled={!inputValue.trim()}
          className="h-7 text-xs"
        >
          <Plus className="size-3 mr-1" />
          {p({ th: 'เพิ่ม', en: 'Add', zh: '添加' })}
        </Button>
        {!disableMe && !value.includes('Me') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addMember('Me')}
            className="h-7 text-xs text-muted-foreground"
          >
            {p({ th: '+ เพิ่มตัวเอง (ฉัน)', en: '+ Add myself', zh: '+ 添加自己' })}
          </Button>
        )}
      </div>
    </div>
  )
}
