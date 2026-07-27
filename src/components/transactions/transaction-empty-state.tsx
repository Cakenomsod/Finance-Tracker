import { Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  const isNoData = variant === 'no-data'
  const isFilteredLoadOlder = variant === 'filtered-load-older'
  const isNoMonth = variant === 'no-month-data'

  const title = isNoData
    ? 'ยังไม่มีธุรกรรม'
    : isNoMonth
      ? 'ไม่มีธุรกรรมในเดือนนี้'
      : 'ไม่พบรายการที่ตรงกับตัวกรอง'

  const description = isNoData
    ? 'เริ่มบันทึกรายรับรายจ่ายด้วยการเพิ่มรายการแรกของคุณ — หรือใช้ช่อง AI ด้านบนเพื่อบันทึกเร็วขึ้น'
    : isFilteredLoadOlder
      ? 'ลองเลื่อนลงเพื่อโหลดรายการเพิ่ม หรือปรับตัวกรองใหม่'
      : isNoMonth
        ? 'เปลี่ยนเดือนด้านบน หรือเพิ่มรายการใหม่สำหรับเดือนนี้'
        : 'ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น'

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
        {isNoData && onAddClick && (
          <Button size="sm" className="gap-2" onClick={onAddClick}>
            <Plus className="size-4" aria-hidden />
            เพิ่มธุรกรรม
          </Button>
        )}
        {!isNoData && onClearFilters && (
          <Button size="sm" variant="outline" onClick={onClearFilters}>
            ล้างตัวกรอง
          </Button>
        )}
        {!isNoData && onAddClick && (
          <Button size="sm" className="gap-2" onClick={onAddClick}>
            <Plus className="size-4" aria-hidden />
            เพิ่มธุรกรรม
          </Button>
        )}
      </div>
    </div>
  )
}
