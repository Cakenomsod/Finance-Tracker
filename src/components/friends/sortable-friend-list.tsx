'use client'

import * as React from 'react'
import {
  GripVertical,
  UserCheck,
  Trash2,
  Pencil,
  Check,
  X,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [removeTarget, setRemoveTarget] = React.useState<FriendListItem | null>(null)
  const [removing, setRemoving] = React.useState(false)

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= items.length || fromIndex === toIndex) return
    const keys = items.map((item) => item.key)
    const [moved] = keys.splice(fromIndex, 1)
    keys.splice(toIndex, 0, moved)
    onReorder(keys)
  }

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) return
    moveItem(dragIndex, toIndex)
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

  const confirmRemove = async () => {
    if (!removeTarget?.customId) return
    setRemoving(true)
    try {
      await onRemoveCustom(removeTarget.customId)
      setRemoveTarget(null)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      <ul className="space-y-3" aria-label="รายชื่อเพื่อน">
        {items.map((item, index) => {
          const isEditing = editingKey === item.key
          const isDragging = dragIndex === index
          const isDropTarget =
            overIndex === index && dragIndex !== null && dragIndex !== index

          return (
            <li
              key={item.key}
              draggable={!isEditing}
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
                'rounded-lg border p-4 transition-[opacity,background-color,border-color] duration-200 motion-reduce:transition-none',
                isDragging && 'opacity-50',
                isDropTarget && 'border-primary bg-primary/5',
              )}
            >
              <div className="flex items-start justify-between gap-3 sm:items-center">
                <div className="flex min-w-0 items-start gap-2 sm:items-center sm:gap-3">
                  <div className="flex shrink-0 flex-col items-center gap-0.5 pt-0.5 sm:pt-0">
                    <button
                      type="button"
                      className={cn(
                        'flex size-9 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground',
                        'transition-colors duration-200 hover:bg-muted hover:text-foreground active:cursor-grabbing',
                        'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        'motion-reduce:transition-none',
                      )}
                      aria-label={`ลากเพื่อจัดลำดับ ${item.displayName}`}
                      aria-grabbed={isDragging}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <GripVertical className="size-4 shrink-0" aria-hidden />
                    </button>
                    <div className="flex flex-col sm:hidden">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={index === 0 || isEditing}
                        aria-label={`เลื่อน ${item.displayName} ขึ้น`}
                        onClick={() => moveItem(index, index - 1)}
                      >
                        <ChevronUp className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        disabled={index === items.length - 1 || isEditing}
                        aria-label={`เลื่อน ${item.displayName} ลง`}
                        onClick={() => moveItem(index, index + 1)}
                      >
                        <ChevronDown className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </div>

                  <Avatar className="size-10 shrink-0">
                    <AvatarFallback
                      className={cn(
                        'text-sm',
                        item.type === 'friend' ? 'bg-primary/15 text-primary' : 'bg-muted',
                      )}
                    >
                      {item.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 pt-0.5 sm:pt-0">
                    <p className="truncate font-medium">{item.displayName}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.type === 'friend'
                        ? 'มีบัญชีในระบบ'
                        : 'รายชื่อที่เพิ่มเอง (ไม่มีบัญชี)'}
                    </p>
                    {item.aliases && item.aliases.length > 0 && !isEditing ? (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        ชื่อเล่น: {item.aliases.join(', ')}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-2">
                  <div className="hidden sm:flex sm:items-center sm:gap-0.5">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      disabled={index === 0 || isEditing}
                      aria-label={`เลื่อน ${item.displayName} ขึ้น`}
                      onClick={() => moveItem(index, index - 1)}
                    >
                      <ChevronUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-9"
                      disabled={index === items.length - 1 || isEditing}
                      aria-label={`เลื่อน ${item.displayName} ลง`}
                      onClick={() => moveItem(index, index + 1)}
                    >
                      <ChevronDown className="size-4" aria-hidden />
                    </Button>
                  </div>

                  {onSaveAliases && !isEditing ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-9 px-0"
                      onClick={() => startEditAliases(item)}
                      aria-label={`แก้ไขชื่อเล่นของ ${item.displayName}`}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                  ) : null}

                  {item.type === 'friend' ? (
                    <Badge variant="outline" className="text-primary border-primary/30">
                      <UserCheck className="mr-1 size-3" aria-hidden />
                      เพื่อน
                    </Badge>
                  ) : (
                    <>
                      <Badge variant="secondary">รายชื่อเอง</Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="size-9 px-0 text-destructive hover:text-destructive"
                        onClick={() => setRemoveTarget(item)}
                        aria-label={`ลบ ${item.displayName} ออกจากรายชื่อ`}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {isEditing && onSaveAliases ? (
                <div className="mt-3 space-y-2 border-t pt-3 pl-0 sm:pl-11">
                  <Label htmlFor={`alias-${item.key}`} className="text-xs">
                    ชื่อเล่น (คั่นด้วยจุลภาค)
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id={`alias-${item.key}`}
                      placeholder="เช่น เบล, Bell"
                      value={aliasDraft}
                      onChange={(e) => setAliasDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveAliases(item)
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="flex-1"
                      disabled={saving}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="min-h-9 flex-1 sm:flex-none"
                        onClick={() => void saveAliases(item)}
                        disabled={saving}
                        aria-label="บันทึกชื่อเล่น"
                      >
                        <Check className="size-4" aria-hidden />
                        <span className="sm:sr-only">บันทึก</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="min-h-9 flex-1 sm:flex-none"
                        onClick={cancelEdit}
                        disabled={saving}
                        aria-label="ยกเลิกการแก้ไข"
                      >
                        <X className="size-4" aria-hidden />
                        <span className="sm:sr-only">ยกเลิก</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open && !removing) setRemoveTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบรายชื่อ?</AlertDialogTitle>
            <AlertDialogDescription>
              ลบ “{removeTarget?.displayName}” ออกจากรายชื่อส่วนตัว — ไม่สามารถกู้คืนได้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={removing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                void confirmRemove()
              }}
            >
              {removing ? 'กำลังลบ...' : 'ลบรายชื่อ'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
