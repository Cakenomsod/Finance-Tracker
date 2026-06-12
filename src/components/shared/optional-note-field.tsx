'use client'

import * as React from 'react'
import { StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface OptionalNoteFieldProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function OptionalNoteField({ value, onChange, className }: OptionalNoteFieldProps) {
  const [expanded, setExpanded] = React.useState(!!value)

  React.useEffect(() => {
    if (value) setExpanded(true)
  }, [value])

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          'h-9 w-full justify-start gap-2 font-normal text-muted-foreground hover:text-foreground',
          className
        )}
        onClick={() => setExpanded(true)}
      >
        <StickyNote className="size-3.5 shrink-0" />
        เพิ่มหมายเหตุ (ไม่บังคับ)
      </Button>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">หมายเหตุ (ไม่บังคับ)</Label>
        {!value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2 text-xs text-muted-foreground"
            onClick={() => {
              onChange('')
              setExpanded(false)
            }}
          >
            <X className="size-3" />
            ปิด
          </Button>
        )}
      </div>
      <Textarea
        placeholder="บันทึกเพิ่มเติม เช่น ใบเสร็จหาย, สถานที่, ข้อตกลง..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="min-h-[60px] resize-none text-sm"
      />
    </div>
  )
}
