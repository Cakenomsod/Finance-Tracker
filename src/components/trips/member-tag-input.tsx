'use client'

import * as React from 'react'
import { X, Plus } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
  placeholder = 'พิมพ์ชื่อแล้วกด Enter...',
  className,
  disableMe = false,
}: MemberTagInputProps) {
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
            {member}
            <button
              type="button"
              onClick={() => removeMember(member)}
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
          placeholder={value.length === 0 ? placeholder : 'เพิ่มคนอื่น...'}
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
          เพิ่ม
        </Button>
        {!disableMe && !value.includes('Me') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => addMember('Me')}
            className="h-7 text-xs text-muted-foreground"
          >
            + เพิ่ม "Me" (ฉัน)
          </Button>
        )}
      </div>
    </div>
  )
}
