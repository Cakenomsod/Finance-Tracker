'use client'

import * as React from 'react'
import { GripVertical, UserCheck, Trash2, Pencil, Check, X } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { FriendListItem } from '@/hooks/use-friends'

interface SortableFriendListProps {
  items: FriendListItem[]
  onReorder: (keys: string[]) => void
  onRemoveCustom: (id: string) => void
  onSaveAliases?: (item: FriendListItem, aliases: string[]) => Promise<void>
}

export function SortableFriendList({
  items,
  onReorder,
  onRemoveCustom,
  onSaveAliases,
}: SortableFriendListProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)
  const [editingKey, setEditingKey] = React.useState<string | null>(null)
  const [aliasDraft, setAliasDraft] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) return
    const keys = items.map((item) => item.key)
    const [moved] = keys.splice(dragIndex, 1)
    keys.splice(toIndex, 0, moved)
    onReorder(keys)
    setDragIndex(null)
    setOverIndex(null)
  }

  const startEditAliases = (item: FriendListItem) => {
    setEditingKey(item.key)
    setAliasDraft((item.aliases || []).join(', '))
  }

  const cancelEdit = () => {
    setEditingKey(null)
    setAliasDraft('')
  }

  const saveAliases = async (item: FriendListItem) => {
    if (!onSaveAliases) return
    setSaving(true)
    try {
      const aliases = aliasDraft
        .split(/[,，]/)
        .map((s) => s.trim())
        .filter(Boolean)
      await onSaveAliases(item, aliases)
      setEditingKey(null)
      setAliasDraft('')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          draggable={editingKey !== item.key}
          onDragStart={() => setDragIndex(index)}
          onDragOver={(e) => {
            e.preventDefault()
            setOverIndex(index)
          }}
          onDrop={(e) => {
            e.preventDefault()
            handleDrop(index)
          }}
          onDragEnd={() => {
            setDragIndex(null)
            setOverIndex(null)
          }}
          className={cn(
            'rounded-lg border p-4 transition-colors',
            dragIndex === index && 'opacity-50',
            overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary bg-primary/5',
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
                aria-label="ลากเพื่อจัดลำดับ"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <GripVertical className="size-4 shrink-0" />
              </button>
              <Avatar className="size-10 shrink-0">
                <AvatarFallback
                  className={cn(
                    'text-sm',
                    item.type === 'friend' ? 'bg-primary/20 text-primary' : 'bg-muted',
                  )}
                >
                  {item.displayName.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{item.displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.type === 'friend' ? 'มีบัญชีในระบบ' : 'รายชื่อที่เพิ่มเอง (ไม่มีบัญชี)'}
                </p>
                {item.aliases && item.aliases.length > 0 && editingKey !== item.key && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    ชื่อเล่น: {item.aliases.join(', ')}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {onSaveAliases && editingKey !== item.key && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={() => startEditAliases(item)}
                  aria-label="แก้ไขชื่อเล่น"
                >
                  <Pencil className="size-4" />
                </Button>
              )}
              {item.type === 'friend' ? (
                <Badge variant="outline" className="text-primary border-primary/30">
                  <UserCheck className="mr-1 size-3" /> เพื่อน
                </Badge>
              ) : (
                <>
                  <Badge variant="secondary">รายชื่อเอง</Badge>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => item.customId && onRemoveCustom(item.customId)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {editingKey === item.key && onSaveAliases && (
            <div className="mt-3 flex gap-2 pl-7">
              <Input
                placeholder="ชื่อเล่น คั่นด้วยจุลภาค เช่น เบล, Bell"
                value={aliasDraft}
                onChange={(e) => setAliasDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void saveAliases(item)
                  if (e.key === 'Escape') cancelEdit()
                }}
                className="flex-1"
                disabled={saving}
              />
              <Button size="sm" onClick={() => saveAliases(item)} disabled={saving}>
                <Check className="size-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                <X className="size-4" />
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
