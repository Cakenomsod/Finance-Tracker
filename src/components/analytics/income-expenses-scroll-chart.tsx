'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

const chartConfig = {
  income: { label: 'Income', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-3)' },
}

const MONTHLY_BAR_WIDTH = 72
const SCROLL_EDGE_THRESHOLD = 48
const LOAD_OLDER_THROTTLE_MS = 600

export type MonthlyChartPoint = {
  month: string
  income: number
  expenses: number
  savings: number
}

export function IncomeExpensesScrollChart({
  data,
  hasOlderData,
  loadingOlder,
  onLoadOlder,
}: {
  data: MonthlyChartPoint[]
  hasOlderData: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollWidthBeforeLoadRef = React.useRef(0)
  const hasScrolledToEndRef = React.useRef(false)
  const lastLoadAttemptRef = React.useRef(0)
  const prevDataLengthRef = React.useRef(data.length)
  const touchStartXRef = React.useRef(0)

  const chartMinWidth = Math.max(data.length * MONTHLY_BAR_WIDTH, 320)

  const tryLoadOlder = React.useCallback(() => {
    if (!hasOlderData || loadingOlder) return
    const now = Date.now()
    if (now - lastLoadAttemptRef.current < LOAD_OLDER_THROTTLE_MS) return
    lastLoadAttemptRef.current = now
    scrollWidthBeforeLoadRef.current = scrollRef.current?.scrollWidth ?? 0
    onLoadOlder()
  }, [hasOlderData, loadingOlder, onLoadOlder])

  const checkLeftEdge = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
      tryLoadOlder()
    }
  }, [tryLoadOlder])

  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (!hasScrolledToEndRef.current && data.length > 0) {
      el.scrollLeft = el.scrollWidth - el.clientWidth
      hasScrolledToEndRef.current = true
      prevDataLengthRef.current = data.length
      return
    }

    if (data.length > prevDataLengthRef.current && scrollWidthBeforeLoadRef.current > 0) {
      const widthAdded = el.scrollWidth - scrollWidthBeforeLoadRef.current
      if (widthAdded > 0) {
        el.scrollLeft += widthAdded
      }
      scrollWidthBeforeLoadRef.current = 0
    }

    prevDataLengthRef.current = data.length
  }, [data.length])

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? 0
  }, [])

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      const el = scrollRef.current
      const touch = e.changedTouches[0]
      if (!el || !touch) return

      const deltaX = touch.clientX - touchStartXRef.current
      if (deltaX > 40 && el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
        tryLoadOlder()
      }
    },
    [tryLoadOlder]
  )

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const canScrollHorizontally = el.scrollWidth > el.clientWidth + 1

      if (canScrollHorizontally) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
        e.preventDefault()
        el.scrollLeft += e.deltaY
        checkLeftEdge()
        return
      }

      if (e.deltaY < 0 && el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
        tryLoadOlder()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [checkLeftEdge, tryLoadOlder])

  return (
    <div className="relative min-w-0">
      <div
        ref={scrollRef}
        className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:thin]"
        onScroll={checkLeftEdge}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full max-w-full min-w-0"
          style={{ minWidth: chartMinWidth }}
        >
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              className="text-xs fill-muted-foreground"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `฿${value / 1000}k`}
              className="text-xs fill-muted-foreground"
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expenses" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
      {(loadingOlder || hasOlderData) && (
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 flex h-8 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-r-md bg-background/80 px-2 text-xs text-muted-foreground backdrop-blur-sm',
            !loadingOlder && 'opacity-60'
          )}
          aria-hidden={!loadingOlder}
        >
          {loadingOlder ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Loading older data...</span>
            </>
          ) : (
            <span>Scroll left for older months</span>
          )}
        </div>
      )}
    </div>
  )
}
