'use client'

import * as React from 'react'
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  formatWeekKey,
  formatWeekLabel,
  getCurrentWeekSelection,
  getIsoWeeksInYear,
  getNextAvailableWeek,
  getNextWeekSelection,
  getPreviousAvailableWeek,
  getPreviousWeekSelection,
  getWeekDateRange,
  hasWeekData,
  isCurrentWeekSelection,
  isSameWeekSelection,
  type WeekSelection,
} from '@/lib/insight-periods'

export function WeekPicker({
  value,
  onChange,
  className,
  size = 'default',
  weeksWithData,
  locale = 'th-TH',
}: {
  value: WeekSelection
  onChange: (value: WeekSelection) => void
  className?: string
  size?: 'default' | 'sm'
  /** When set, only these `YYYY-Www` weeks are selectable. */
  weeksWithData?: Set<string>
  locale?: string
}) {
  const [open, setOpen] = React.useState(false)
  const [pickerYear, setPickerYear] = React.useState(value.year)
  const [yearDirection, setYearDirection] = React.useState<'prev' | 'next'>('next')

  const restrictToData = weeksWithData !== undefined

  React.useEffect(() => {
    if (open) setPickerYear(value.year)
  }, [open, value.year])

  const label = formatWeekLabel(value, locale)
  const isCurrent = isCurrentWeekSelection(value)
  const currentWeekHasData =
    !restrictToData || hasWeekData(weeksWithData, getCurrentWeekSelection())

  const prevWeek = restrictToData
    ? getPreviousAvailableWeek(value, weeksWithData)
    : getPreviousWeekSelection(value)
  const nextWeek = restrictToData
    ? getNextAvailableWeek(value, weeksWithData)
    : getNextWeekSelection(value)

  const weeksInYear = getIsoWeeksInYear(pickerYear)

  const goToPrevWeek = () => {
    if (prevWeek) onChange(prevWeek)
  }

  const goToNextWeek = () => {
    if (nextWeek) onChange(nextWeek)
  }

  const goToPrevYear = () => {
    setYearDirection('prev')
    setPickerYear((year) => year - 1)
  }

  const goToNextYear = () => {
    setYearDirection('next')
    setPickerYear((year) => year + 1)
  }

  const yearSlideClass =
    yearDirection === 'prev' ? 'slide-in-from-left-4' : 'slide-in-from-right-4'

  return (
    <div className={cn('inline-flex items-center gap-0.5', className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(size === 'sm' ? 'size-7' : 'size-8')}
        onClick={goToPrevWeek}
        disabled={!prevWeek}
        aria-label="สัปดาห์ก่อนหน้า"
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn(
              'min-w-[160px] justify-center gap-2',
              size === 'sm' && 'h-8 text-xs'
            )}
          >
            <Calendar className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="center">
          <div className="mb-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={goToPrevYear}
              aria-label="ปีก่อนหน้า"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span
              key={`year-${pickerYear}`}
              className={cn(
                'text-sm font-semibold animate-in fade-in-0 duration-200 motion-reduce:animate-none',
                yearSlideClass
              )}
            >
              {new Date(pickerYear, 0, 1).toLocaleDateString(locale, {
                year: 'numeric',
              })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={goToNextYear}
              aria-label="ปีถัดไป"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div
            key={`weeks-${pickerYear}`}
            className={cn(
              'grid max-h-56 grid-cols-2 gap-1.5 overflow-y-auto animate-in fade-in-0 duration-200 motion-reduce:animate-none',
              yearDirection === 'prev'
                ? 'slide-in-from-left-2'
                : 'slide-in-from-right-2'
            )}
          >
            {Array.from({ length: weeksInYear }, (_, i) => {
              const week = i + 1
              const selection: WeekSelection = { year: pickerYear, week }
              const selected = isSameWeekSelection(selection, value)
              const isThisWeek = isCurrentWeekSelection(selection)
              const hasData =
                !restrictToData || hasWeekData(weeksWithData, selection)
              const { start, end } = getWeekDateRange(selection)
              const rangeHint = `${start.getDate()}/${start.getMonth() + 1}–${end.getDate()}/${end.getMonth() + 1}`

              return (
                <Button
                  key={formatWeekKey(selection)}
                  type="button"
                  variant={selected ? 'default' : 'ghost'}
                  size="sm"
                  disabled={!hasData}
                  className={cn(
                    'h-auto flex-col items-start gap-0.5 px-2 py-1.5 text-left text-xs',
                    !hasData &&
                      'pointer-events-none cursor-not-allowed opacity-35 text-muted-foreground',
                    isThisWeek && !selected && hasData && 'ring-1 ring-primary/40'
                  )}
                  aria-disabled={!hasData}
                  aria-label={
                    hasData
                      ? `สัปดาห์ ${week}`
                      : `สัปดาห์ ${week} — ไม่มีข้อมูล`
                  }
                  onClick={() => {
                    if (!hasData) return
                    onChange(selection)
                    setOpen(false)
                  }}
                >
                  <span className="font-medium">W{String(week).padStart(2, '0')}</span>
                  <span className="text-[10px] font-normal opacity-80">{rangeHint}</span>
                </Button>
              )
            })}
          </div>
          {!isCurrent && currentWeekHasData && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => {
                onChange(getCurrentWeekSelection())
                setOpen(false)
              }}
            >
              กลับไปสัปดาห์ปัจจุบัน
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(size === 'sm' ? 'size-7' : 'size-8')}
        onClick={goToNextWeek}
        disabled={!nextWeek}
        aria-label="สัปดาห์ถัดไป"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
