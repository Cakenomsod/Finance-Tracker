'use client'

import * as React from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFriends } from '@/hooks/use-friends'
import { cn } from '@/lib/utils'

interface AddContactInlineProps {
  onAdded?: (contact: { key: string; displayName: string }) => void
  label?: string
  className?: string
  disabled?: boolean
}

/** Creates a custom contact without leaving the current form. */
export function AddContactInline({
  onAdded,
  label = 'เพิ่มรายชื่อใหม่',
  className,
  disabled,
}: AddContactInlineProps) {
  const { addCustomFriend } = useFriends()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputId = React.useId()

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('กรุณากรอกชื่อ')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await addCustomFriend(trimmed)
      onAdded?.(created)
      setName('')
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เพิ่มรายชื่อไม่สำเร็จ')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn('h-9 gap-1.5 px-2 text-xs text-primary hover:text-primary', className)}
      >
        <UserPlus className="size-3.5" aria-hidden />
        {label}
      </Button>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      <label htmlFor={inputId} className="sr-only">
        ชื่อรายชื่อใหม่
      </label>
      <div className="flex gap-1.5">
        <Input
          id={inputId}
          autoFocus
          value={name}
          placeholder="ชื่อเพื่อน เช่น บี"
          className="h-9 min-w-0 flex-1 text-sm"
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            setName(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void submit()
            }
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
              setName('')
              setError(null)
            }
          }}
        />
        <Button type="button" size="sm" className="h-9" disabled={saving} onClick={() => void submit()}>
          {saving ? 'กำลังเพิ่ม…' : 'เพิ่ม'}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => {
            setOpen(false)
            setName('')
            setError(null)
          }}
        >
          ยกเลิก
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">เพื่อนไม่ต้องมีบัญชีก็หารได้</p>
      )}
    </div>
  )
}
