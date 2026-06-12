'use client'

import * as React from 'react'
import { GripVertical, UserCheck, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FriendListItem } from '@/hooks/use-friends'

interface SortableFriendListProps {
  items: FriendListItem[]
  onReorder: (keys: string[]) => void
  onRemoveCustom: (id: string) => void
}

export function SortableFriendList({ items, onReorder, onRemoveCustom }: SortableFriendListProps) {
  const [dragIndex, setDragIndex] = React.useState<number | null>(null)
  const [overIndex, setOverIndex] = React.useState<number | null>(null)

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) return
    const keys = items.map((item) => item.key)
    const [moved] = keys.splice(dragIndex, 1)
    keys.splice(toIndex, 0, moved)
    onReorder(keys)
    setDragIndex(null)
    setOverIndex(null)
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div
          key={item.key}
          draggable
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
            'flex items-center justify-between rounded-lg border p-4 transition-colors',
            dragIndex === index && 'opacity-50',
            overIndex === index && dragIndex !== null && dragIndex !== index && 'border-primary bg-primary/5',
          )}
        >
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
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
      ))}
    </div>
  )
}
