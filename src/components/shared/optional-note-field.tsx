'use client'

import * as React from 'react'
import { StickyNote, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useLocale } from '@/components/locale-provider'
import { cn } from '@/lib/utils'

interface OptionalNoteFieldProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function OptionalNoteField({ value, onChange, className }: OptionalNoteFieldProps) {
  const { p } = useLocale()
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
        {p({ th: 'เพิ่มหมายเหตุ (ไม่บังคับ)', en: 'Add a note (optional)', zh: '添加备注（可选）' })}
      </Button>
    )
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm">
          {p({ th: 'หมายเหตุ (ไม่บังคับ)', en: 'Note (optional)', zh: '备注（可选）' })}
        </Label>
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
            {p({ th: 'ปิด', en: 'Close', zh: '关闭' })}
          </Button>
        )}
      </div>
      <Textarea
        placeholder={p({
          th: 'บันทึกเพิ่มเติม เช่น ใบเสร็จหาย, สถานที่, ข้อตกลง...',
          en: 'Extra details, e.g. lost receipt, place, agreement...',
          zh: '补充说明，例如：收据丢失、地点、约定...',
        })}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="min-h-[60px] resize-none text-sm"
      />
    </div>
  )
}
