import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function DashboardSkeleton() {
  return (
    <div
      className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 sm:gap-6 sm:p-6"
      aria-busy="true"
      aria-label="Loading dashboard"
    >
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-64 max-w-full" />
        </div>
        <Skeleton className="h-9 w-40 shrink-0" />
      </div>

      <Card className="min-w-0">
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-3 h-10 w-52 max-w-full" />
          <Skeleton className="mt-2 h-4 w-36" />
          <div className="mt-6 grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3 sm:gap-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-28 max-w-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader className="px-4 sm:px-6">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="mt-2 h-4 w-52 max-w-full" />
        </CardHeader>
        <CardContent className="grid gap-3 px-4 sm:grid-cols-2 sm:px-6">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="px-4 sm:px-6">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-4 w-56 max-w-full" />
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <Skeleton className="h-[280px] w-full" />
          </CardContent>
        </Card>
        <Card className="min-w-0">
          <CardHeader className="px-4 sm:px-6">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-2 h-4 w-40 max-w-full" />
          </CardHeader>
          <CardContent className="space-y-3 px-4 sm:px-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0">
        <CardHeader className="px-4 sm:px-6">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="mt-2 h-4 w-36" />
        </CardHeader>
        <CardContent className="grid gap-6 px-4 md:grid-cols-2 sm:px-6">
          <Skeleton className="mx-auto h-[180px] w-full max-w-[220px] rounded-full" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
