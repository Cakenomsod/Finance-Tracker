'use client'

import * as React from 'react'
import { Plus, X, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useFriends } from '@/hooks/use-friends'
import { useLocale } from '@/components/locale-provider'

export interface PickedMember {
  /** userId for friends, or name string for manual entries */
  key: string
  displayName: string
  photoURL?: string | null
  isManual?: boolean
}

interface MemberPickerProps {
  value: PickedMember[]
  onChange: (members: PickedMember[]) => void
  /** Exclude self from friends list if needed */
  selfUid?: string
  className?: string
}

export function MemberPicker({ value, onChange, selfUid, className }: MemberPickerProps) {
  const { friendListItems, addCustomFriend } = useFriends()
  const { p } = useLocale()
  const [manualName, setManualName] = React.useState('')
  const [adding, setAdding] = React.useState(false)

  const selectedKeys = new Set(value.map((m) => m.key))

  const toggle = (member: PickedMember) => {
    if (selectedKeys.has(member.key)) {
      onChange(value.filter((m) => m.key !== member.key))
    } else {
      onChange([...value, member])
    }
  }

  // New names become saved contacts so they show up next time (trips, splits, debts).
  const addManual = async () => {
    const name = manualName.trim()
    if (!name || adding) return
    const lower = name.toLowerCase()
    const existing = friendListItems.find((item) => item.displayName.toLowerCase() === lower)
    if (existing) {
      if (!selectedKeys.has(existing.key)) {
        onChange([
          ...value,
          {
            key: existing.key,
            displayName: existing.displayName,
            photoURL: existing.photoURL,
            isManual: existing.type === 'custom',
          },
        ])
      }
      setManualName('')
      return
    }
    setAdding(true)
    try {
      const created = await addCustomFriend(name)
      onChange([...value, { key: created.key, displayName: created.displayName, isManual: true }])
    } catch {
      if (!selectedKeys.has(name)) {
        onChange([...value, { key: name, displayName: name, isManual: true }])
      }
    } finally {
      setAdding(false)
      setManualName('')
    }
  }

  const remove = (key: string) => onChange(value.filter((m) => m.key !== key))

  const availableContacts = friendListItems.filter(
    (item) => item.type !== 'friend' || item.key !== selfUid,
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected members */}
      {value.length > 0 && (
        <div
          className="flex flex-wrap gap-2"
          aria-label={p({ th: 'สมาชิกที่เลือก', en: 'Selected members', zh: '已选成员' })}
        >
          {value.map((m) => (
            <Badge key={m.key} variant="secondary" className="flex items-center gap-1 py-1 pl-2 pr-1">
              <span className="text-sm font-medium">{m.displayName}</span>
              <button
                type="button"
                onClick={() => remove(m.key)}
                aria-label={p({
                  th: `เอา ${m.displayName} ออก`,
                  en: `Remove ${m.displayName}`,
                  zh: `移除 ${m.displayName}`,
                })}
                className={cn(
                  'ml-1 flex size-7 items-center justify-center rounded-full',
                  'transition-colors duration-150 ease-out motion-reduce:transition-none',
                  'hover:bg-muted-foreground/20',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50'
                )}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Friends list */}
      {availableContacts.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            {p({ th: 'รายชื่อของคุณ', en: 'Your contacts', zh: '你的联系人' })}
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-label={p({
              th: 'เลือกสมาชิกจากรายชื่อ',
              en: 'Pick members from your contacts',
              zh: '从联系人中选择成员',
            })}
          >
            {availableContacts.map((item) => {
              const isSelected = selectedKeys.has(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => toggle({
                    key: item.key,
                    displayName: item.displayName,
                    photoURL: item.photoURL,
                    isManual: item.type === 'custom',
                  })}
                  className={cn(
                    'flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium',
                    'transition-[background-color,border-color,color] duration-150 ease-out',
                    'motion-reduce:transition-none',
                    'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    isSelected
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background hover:border-primary/40'
                  )}
                >
                  <Avatar className="size-5">
                    <AvatarFallback className="text-xs">
                      {item.displayName.substring(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {item.displayName}
                  {isSelected && <UserCheck className="size-3" aria-hidden />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual name entry */}
      <div>
        <p className="mb-2 text-xs text-muted-foreground">
          {p({
            th: 'เพิ่มชื่อใหม่ — จะบันทึกไว้ในรายชื่อให้ใช้ครั้งหน้า (เพื่อนไม่ต้องมีบัญชี)',
            en: "Add a new name — it's saved to your contacts for next time (friends don't need an account)",
            zh: '添加新名字——会保存到联系人方便下次使用（朋友无需注册账号）',
          })}
        </p>
        <div className="flex gap-2">
          <Input
            placeholder={p({
              th: 'พิมพ์ชื่อแล้วกด Enter',
              en: 'Type a name and press Enter',
              zh: '输入名字后按回车',
            })}
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void addManual() } }}
            className="h-10 flex-1"
            aria-label={p({
              th: 'เพิ่มสมาชิกด้วยชื่อ',
              en: 'Add a member by name',
              zh: '按名字添加成员',
            })}
          />
          <Button
            type="button"
            variant="outline"
            className="h-10"
            onClick={() => void addManual()}
            disabled={!manualName.trim() || adding}
            aria-label={p({ th: 'เพิ่มสมาชิก', en: 'Add member', zh: '添加成员' })}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  )
}
