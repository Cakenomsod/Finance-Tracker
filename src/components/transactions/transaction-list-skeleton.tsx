import { Skeleton } from '@/components/ui/skeleton'
import { TableCell, TableRow } from '@/components/ui/table'

const TABLE_SKELETON_ROWS = 6
const MOBILE_SKELETON_ROWS = 4

export function TransactionTableSkeleton() {
  return (
    <>
      {Array.from({ length: TABLE_SKELETON_ROWS }).map((_, index) => (
        <TableRow key={index} className="hover:bg-transparent">
          <TableCell>
            <Skeleton className="h-4 w-12" />
          </TableCell>
          <TableCell>
            <div className="space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
          </TableCell>
          <TableCell>
            <Skeleton className="h-5 w-20" />
          </TableCell>
          <TableCell>
            <Skeleton className="h-4 w-16" />
          </TableCell>
          <TableCell className="text-right">
            <Skeleton className="ml-auto h-4 w-16" />
          </TableCell>
          <TableCell>
            <Skeleton className="size-8 rounded-md" />
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

export function TransactionMobileListSkeleton() {
  return (
    <div className="space-y-3 md:hidden" aria-busy="true" aria-label="กำลังโหลดธุรกรรม">
      {Array.from({ length: MOBILE_SKELETON_ROWS }).map((_, index) => (
        <div key={index} className="overflow-hidden rounded-lg border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4 max-w-full" />
              <div className="flex gap-1.5">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-5 w-16" />
              </div>
              <Skeleton className="h-3 w-1/2 max-w-full" />
            </div>
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}
