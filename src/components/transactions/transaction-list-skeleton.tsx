import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

const TABLE_SKELETON_ROWS = 8
const MOBILE_SKELETON_GROUPS = 2
const MOBILE_SKELETON_ROWS = 3

export function TransactionTableSkeleton() {
  return (
    <>
      {Array.from({ length: TABLE_SKELETON_ROWS }).map((_, index) => (
        <TableRow
          key={index}
          className="animate-in fade-in-0 duration-200 fill-mode-both hover:bg-transparent motion-reduce:animate-none"
        >
          <TableCell className="py-2.5">
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell className="py-2.5">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="h-5 w-20 rounded-md" />
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="py-2.5 text-right">
            <Skeleton className="ml-auto h-4 w-16" />
          </TableCell>
          <TableCell className="py-2.5">
            <Skeleton className="size-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function TransactionMobileListSkeleton() {
  return (
    <div
      className="space-y-3 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none md:hidden"
      aria-busy="true"
      aria-label="กำลังโหลดธุรกรรม"
    >
      {Array.from({ length: MOBILE_SKELETON_GROUPS }).map((_, groupIndex) => (
        <div
          key={groupIndex}
          className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
          <div className="border-b bg-muted/30 px-3 py-2">
            <Skeleton className="h-3 w-28" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: MOBILE_SKELETON_ROWS }).map((_, index) => (
              <div key={index} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4 max-w-full" />
                  <div className="flex gap-1.5">
                    <Skeleton className="h-5 w-14 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                  <Skeleton className="h-3 w-1/2 max-w-full" />
                </div>
                <Skeleton className="h-5 w-16 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
