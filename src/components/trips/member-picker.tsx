'use client'

import * as React from 'react'
import { Plus, X, UserCheck } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useFriends } from '@/hooks/use-friends'

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
  const { friends, customFriends } = useFriends()
  const [manualName, setManualName] = React.useState('')

  const selectedKeys = new Set(value.map((m) => m.key))

  const toggle = (member: PickedMember) => {
    if (selectedKeys.has(member.key)) {
      onChange(value.filter((m) => m.key !== member.key))
    } else {
      onChange([...value, member])
    }
  }

  const addManual = () => {
    const name = manualName.trim()
    if (!name) return
    if (selectedKeys.has(name)) return
    onChange([...value, { key: name, displayName: name, isManual: true }])
    setManualName('')
  }

  const remove = (key: string) => onChange(value.filter((m) => m.key !== key))

  const availableFriends = friends.filter((f) => f.uid !== selfUid)

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected members */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((m) => (
            <Badge key={m.key} variant="secondary" className="flex items-center gap-1 pl-2 pr-1 py-1">
              <span className="text-xs font-medium">{m.displayName}</span>
              <button
                type="button"
                onClick={() => remove(m.key)}
                className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Friends list */}
      {(availableFriends.length > 0 || customFriends.length > 0) && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">รายชื่อของคุณ</p>
          <div className="flex flex-wrap gap-2">
            {availableFriends.map((f) => {
              const isSelected = selectedKeys.has(f.uid)
              return (
                <button
                  key={f.uid}
                  type="button"
                  onClick={() => toggle({ key: f.uid, displayName: f.displayName, photoURL: f.photoURL })}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  )}
                >
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[9px]">
                      {f.displayName.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {f.displayName}
                  {isSelected && <UserCheck className="size-3" />}
                </button>
              )
            })}
            {customFriends.map((cf) => {
              const key = `custom:${cf.id}`
              const isSelected = selectedKeys.has(key)
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggle({ key, displayName: cf.name, isManual: true })}
                  className={cn(
                    'flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                    isSelected
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  )}
                >
                  <Avatar className="size-5">
                    <AvatarFallback className="text-[9px]">
                      {cf.name.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {cf.name}
                  {isSelected && <UserCheck className="size-3" />}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Manual name entry */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">เพิ่มชื่อเอง</p>
        <div className="flex gap-2">
          <Input
            placeholder="พิมพ์ชื่อแล้วกด Enter..."
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
            className="flex-1"
          />
          <Button type="button" variant="outline" size="sm" onClick={addManual} disabled={!manualName.trim()}>
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
