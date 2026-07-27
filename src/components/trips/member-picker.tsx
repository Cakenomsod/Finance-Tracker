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
  const { friendListItems } = useFriends()
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

  const availableContacts = friendListItems.filter(
    (item) => item.type !== 'friend' || item.key !== selfUid,
  )

  return (
    <div className={cn('space-y-3', className)}>
      {/* Selected members */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2" aria-label="Selected members">
          {value.map((m) => (
            <Badge key={m.key} variant="secondary" className="flex items-center gap-1 py-1 pl-2 pr-1">
              <span className="text-xs font-medium">{m.displayName}</span>
              <button
                type="button"
                onClick={() => remove(m.key)}
                aria-label={`Remove ${m.displayName}`}
                className={cn(
                  'ml-1 rounded-full p-0.5',
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
          <p className="mb-2 text-xs text-muted-foreground">รายชื่อของคุณ · Your contacts</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Pick members from contacts">
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
                    <AvatarFallback className="text-[9px]">
                      {item.displayName.substring(0, 2).toUpperCase()}
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
        <p className="mb-2 text-xs text-muted-foreground">เพิ่มชื่อเอง · Add a name</p>
        <div className="flex gap-2">
          <Input
            placeholder="Type a name, then Enter…"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addManual() } }}
            className="flex-1"
            aria-label="Add member by name"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-9"
            onClick={addManual}
            disabled={!manualName.trim()}
            aria-label="Add named member"
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
