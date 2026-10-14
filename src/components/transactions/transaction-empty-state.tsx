'use client'

import { Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/locale-provider'
import { cn } from '@/lib/utils'

type TransactionEmptyStateProps = {
  variant: 'no-data' | 'no-results' | 'filtered-load-older' | 'no-month-data'
  onAddClick?: () => void
  onClearFilters?: () => void
  className?: string
}

export function TransactionEmptyState({
  variant,
  onAddClick,
  onClearFilters,
  className,
}: TransactionEmptyStateProps) {
  const { p } = useLocale()
  const isNoData = variant === 'no-data'
  const isFilteredLoadOlder = variant === 'filtered-load-older'
  const isNoMonth = variant === 'no-month-data'

  const title = isNoData
    ? p({ th: 'ยังไม่มีรายการ', en: 'No entries yet', zh: '还没有记录' })
    : isNoMonth
      ? p({ th: 'เดือนนี้ยังไม่มีรายการ', en: 'Nothing this month', zh: '本月没有记录' })
      : p({ th: 'ไม่พบรายการที่ตรงกับตัวกรอง', en: 'No entries match your filters', zh: '没有符合筛选的记录' })

  const description = isNoData
    ? p({
        th: 'จดรายการแรกได้ภายใน 5 วินาที — ใส่แค่จำนวนเงินแล้วกดบันทึก หรือพิมพ์ "ข้าว 45" ในช่อง AI ด้านบน',
        en: 'Your first entry takes 5 seconds — enter an amount and save, or type "lunch 45" in the AI box above',
        zh: '第一条记录只需 5 秒——输入金额保存，或在上方 AI 框输入"午饭 45"',
      })
    : isFilteredLoadOlder
      ? p({
          th: 'เลื่อนลงเพื่อโหลดรายการเก่าเพิ่ม หรือปรับตัวกรองใหม่',
          en: 'Scroll down to load older entries, or change the filters',
          zh: '向下滚动加载更早记录，或调整筛选',
        })
      : isNoMonth
        ? p({
            th: 'เปลี่ยนเดือนด้านบน หรือเพิ่มรายการใหม่ของเดือนนี้',
            en: 'Pick another month above, or add an entry for this month',
            zh: '在上方切换月份，或为本月添加记录',
          })
        : p({
            th: 'ลองคำค้นอื่น หรือเลือกหมวดหมู่อื่น',
            en: 'Try a different search or category',
            zh: '换个关键词或类别试试',
          })

  const addLabel = p({ th: 'จดรายการ', en: 'Add entry', zh: '添加记录' })

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-4 py-12 text-center animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none',
        className
      )}
      role="status"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <Receipt className="size-6 text-muted-foreground" aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold tracking-tight">{title}</p>
      <p className="mt-1 max-w-sm text-pretty text-sm text-muted-foreground">
        {description}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {!isNoData && onClearFilters && (
          <Button variant="outline" className="h-10" onClick={onClearFilters}>
            {p({ th: 'ล้างตัวกรอง', en: 'Clear filters', zh: '清除筛选' })}
          </Button>
        )}
        {onAddClick && (
          <Button className="h-10 gap-2" onClick={onAddClick}>
            <Plus className="size-4" aria-hidden />
            {addLabel}
          </Button>
        )}
      </div>
    </div>
  )
}
