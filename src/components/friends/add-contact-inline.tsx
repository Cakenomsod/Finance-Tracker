'use client'

import * as React from 'react'
import { UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useFriends } from '@/hooks/use-friends'
import { useLocale } from '@/components/locale-provider'
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
  label: labelProp,
  className,
  disabled,
}: AddContactInlineProps) {
  const { p, t } = useLocale()
  const label = labelProp ?? p({ th: 'เพิ่มรายชื่อใหม่', en: 'Add new contact', zh: '添加新联系人' })
  const { addCustomFriend } = useFriends()
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const inputId = React.useId()

  const submit = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setError(p({ th: 'กรุณากรอกชื่อ', en: 'Please enter a name', zh: '请输入名字' }))
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
      setError(
        err instanceof Error
          ? err.message
          : p({ th: 'เพิ่มรายชื่อไม่สำเร็จ', en: "Couldn't add contact", zh: '添加联系人失败' })
      )
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
        {p({ th: 'ชื่อรายชื่อใหม่', en: 'New contact name', zh: '新联系人名字' })}
      </label>
      <div className="flex gap-1.5">
        <Input
          id={inputId}
          autoFocus
          value={name}
          placeholder={p({ th: 'ชื่อเพื่อน เช่น บี', en: "Friend's name, e.g. Bee", zh: '好友名字，例如：小明' })}
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
          {saving
            ? p({ th: 'กำลังเพิ่ม…', en: 'Adding…', zh: '添加中…' })
            : p({ th: 'เพิ่ม', en: 'Add', zh: '添加' })}
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
          {t('common.cancel')}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {p({
            th: 'เพื่อนไม่ต้องมีบัญชีก็หารได้',
            en: "Friends don't need an account to split bills.",
            zh: '好友无需账户也能分账。',
          })}
        </p>
      )}
    </div>
  )
}
