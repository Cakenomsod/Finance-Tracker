import { Plus, Receipt } from 'lucide-react'
import { Button } from '@/components/ui/button'

type TransactionEmptyStateProps = {
  variant: 'no-data' | 'no-results' | 'filtered-load-older'
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

  return (
    <div className={className ?? 'flex flex-col items-center justify-center px-4 py-12 text-center'}>
      <Receipt className="size-10 text-muted-foreground/50" aria-hidden />
      <p className="mt-4 text-lg font-medium">
        {isNoData ? 'ยังไม่มีธุรกรรม' : 'ไม่พบรายการที่ตรงกับตัวกรอง'}
      </p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {isNoData
          ? 'เริ่มบันทึกรายรับรายจ่ายด้วยการเพิ่มรายการแรกของคุณ'
          : isFilteredLoadOlder
            ? 'ลองเลื่อนลงเพื่อโหลดรายการเพิ่ม หรือปรับตัวกรองใหม่'
            : 'ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น'}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {isNoData && onAddClick && (
          <Button size="sm" className="gap-2" onClick={onAddClick}>
            <Plus className="size-4" />
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
            <Plus className="size-4" />
            เพิ่มธุรกรรม
          </Button>
        )}
      </div>
    </div>
  )
}
