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
  formatMonthLabel,
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  getNextAvailableMonth,
  getPreviousAvailableMonth,
  getPreviousMonthSelection,
  hasMonthData,
  isCurrentMonthSelection,
  isSameMonthSelection,
  type MonthSelection,
} from '@/lib/datetime'
import { useLocale } from '@/components/locale-provider'
import { intlLocale } from '@/lib/i18n'

function monthShortNames(localeTag: string): string[] {
  const fmt = new Intl.DateTimeFormat(localeTag, { month: 'short' })
  return Array.from({ length: 12 }, (_, month) => fmt.format(new Date(2000, month, 1)))
}

function getNextMonthSelection({ year, month }: MonthSelection): MonthSelection {
  if (month === 11) return { year: year + 1, month: 0 }
  return { year, month: month + 1 }
}

export function MonthPicker({
  value,
  onChange,
  className,
  size = 'default',
  monthsWithData,
  locale: localeOverride,
}: {
  value: MonthSelection
  onChange: (value: MonthSelection) => void
  className?: string
  size?: 'default' | 'sm'
  /** When set, only these `YYYY-MM` months are selectable. */
  monthsWithData?: Set<string>
  /** BCP-47 tag; defaults to the app locale. */
  locale?: string
}) {
  const { locale: appLocale, p } = useLocale()
  const localeTag = localeOverride ?? intlLocale(appLocale)
  const monthNames = React.useMemo(() => monthShortNames(localeTag), [localeTag])
  const [open, setOpen] = React.useState(false)
  const [pickerYear, setPickerYear] = React.useState(value.year)
  const [yearDirection, setYearDirection] = React.useState<'prev' | 'next'>('next')

  const restrictToData = monthsWithData !== undefined

  React.useEffect(() => {
    if (open) setPickerYear(value.year)
  }, [open, value.year])

  const label = formatMonthLabel(value, localeTag)
  const isCurrent = isCurrentMonthSelection(value)
  const currentMonthHasData =
    !restrictToData || hasMonthData(monthsWithData, getCurrentMonthSelection())

  const prevMonth = restrictToData
    ? getPreviousAvailableMonth(value, monthsWithData)
    : getPreviousMonthSelection(value)
  const nextMonth = restrictToData
    ? getNextAvailableMonth(value, monthsWithData)
    : getNextMonthSelection(value)

  const goToPrevMonth = () => {
    if (prevMonth) onChange(prevMonth)
  }

  const goToNextMonth = () => {
    if (nextMonth) onChange(nextMonth)
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
        onClick={goToPrevMonth}
        disabled={!prevMonth}
        aria-label={p({ th: 'เดือนก่อนหน้า', en: 'Previous month', zh: '上个月' })}
      >
        <ChevronLeft className="size-4" />
      </Button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size={size === 'sm' ? 'sm' : 'default'}
            className={cn('min-w-[140px] justify-center gap-2', size === 'sm' && 'h-8 text-xs')}
          >
            <Calendar className="size-4 shrink-0" />
            <span className="truncate">{label}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="center">
          <div className="mb-3 flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={goToPrevYear}
              aria-label={p({ th: 'ปีก่อนหน้า', en: 'Previous year', zh: '上一年' })}
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
              {new Date(pickerYear, 0, 1).toLocaleDateString(localeTag, { year: 'numeric' })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={goToNextYear}
              aria-label={p({ th: 'ปีถัดไป', en: 'Next year', zh: '下一年' })}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div
            key={`months-${pickerYear}`}
            className={cn(
              'grid grid-cols-3 gap-1.5 animate-in fade-in-0 duration-200 motion-reduce:animate-none',
              yearDirection === 'prev' ? 'slide-in-from-left-2' : 'slide-in-from-right-2'
            )}
          >
            {monthNames.map((name, month) => {
              const selection: MonthSelection = { year: pickerYear, month }
              const selected = isSameMonthSelection(selection, value)
              const isThisMonth = isCurrentMonthSelection(selection)
              const hasData =
                !restrictToData || hasMonthData(monthsWithData, selection)

              return (
                <Button
                  key={month}
                  type="button"
                  variant={selected ? 'default' : 'ghost'}
                  size="sm"
                  disabled={!hasData}
                  className={cn(
                    'h-8 text-xs',
                    !hasData &&
                      'pointer-events-none cursor-not-allowed opacity-35 text-muted-foreground',
                    isThisMonth && !selected && hasData && 'ring-1 ring-primary/40'
                  )}
                  aria-disabled={!hasData}
                  aria-label={
                    hasData
                      ? name
                      : `${name} — ${p({ th: 'ไม่มีข้อมูล', en: 'No data', zh: '无数据' })}`
                  }
                  onClick={() => {
                    if (!hasData) return
                    onChange(selection)
                    setOpen(false)
                  }}
                >
                  {name}
                </Button>
              )
            })}
          </div>
          {!isCurrent && currentMonthHasData && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs"
              onClick={() => {
                onChange(getCurrentMonthSelection())
                setOpen(false)
              }}
            >
              {p({ th: 'กลับไปเดือนปัจจุบัน', en: 'Back to this month', zh: '回到本月' })}
            </Button>
          )}
        </PopoverContent>
      </Popover>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(size === 'sm' ? 'size-7' : 'size-8')}
        onClick={goToNextMonth}
        disabled={!nextMonth}
        aria-label={p({ th: 'เดือนถัดไป', en: 'Next month', zh: '下个月' })}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}
