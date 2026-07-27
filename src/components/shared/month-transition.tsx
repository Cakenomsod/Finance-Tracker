'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'
import { isSameMonthSelection, monthSelectionToKey, type MonthSelection } from '@/lib/datetime'

export type MonthDirection = 'prev' | 'next'

export function getMonthDirection(from: MonthSelection, to: MonthSelection): MonthDirection {
  const fromIndex = from.year * 12 + from.month
  const toIndex = to.year * 12 + to.month
  return toIndex < fromIndex ? 'prev' : 'next'
}

/** Tracks slide direction when month changes via MonthPicker. */
export function useMonthTransition(month: MonthSelection) {
  const [direction, setDirection] = React.useState<MonthDirection>('next')
  const monthKey = monthSelectionToKey(month)

  const onMonthChange = React.useCallback(
    (next: MonthSelection, onChange: (value: MonthSelection) => void) => {
      setDirection(getMonthDirection(month, next))
      onChange(next)
    },
    [month]
  )

  return { monthKey, direction, onMonthChange }
}

const SLIDE_IN = {
  prev: 'slide-in-from-left-2',
  next: 'slide-in-from-right-2',
} as const

/** Re-mounts children on month change with fade + directional slide (tw-animate-css). */
export function MonthContentTransition({
  monthKey,
  direction,
  children,
  className,
}: {
  monthKey: string
  direction: MonthDirection
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      key={monthKey}
      className={cn(
        'min-w-0 animate-in fade-in-0 duration-200 ease-out fill-mode-both motion-reduce:animate-none',
        SLIDE_IN[direction],
        className
      )}
    >
      {children}
    </div>
  )
}

/** Fade + subtle scale for stat values and labels that change with month. */
export function MonthAnimatedValue({
  valueKey,
  children,
  className,
}: {
  valueKey: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      key={valueKey}
      className={cn(
        'inline-block animate-in fade-in-0 zoom-in-95 duration-200 ease-out fill-mode-both motion-reduce:animate-none',
        className
      )}
    >
      {children}
    </span>
  )
}

/**
 * Convenience wrapper — derives direction from month changes without useMonthTransition.
 * Use `className="contents"` when wrapping grid/flex children without breaking layout.
 */
export function MonthTransition({
  month,
  children,
  className,
  delay = 0,
}: {
  month: MonthSelection
  children: React.ReactNode
  className?: string
  delay?: number
}) {
  const prevMonthRef = React.useRef(month)
  const directionRef = React.useRef<MonthDirection>('next')

  if (!isSameMonthSelection(prevMonthRef.current, month)) {
    directionRef.current = getMonthDirection(prevMonthRef.current, month)
    prevMonthRef.current = month
  }

  const monthKey = monthSelectionToKey(month)
  const direction = directionRef.current

  return (
    <div
      key={monthKey}
      className={cn(
        'min-w-0 animate-in fade-in-0 duration-200 ease-out fill-mode-both motion-reduce:animate-none',
        SLIDE_IN[direction],
        className
      )}
      style={delay > 0 ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  )
}

/** Wrap each child in a staggered MonthTransition (grid-safe via `contents`). */
export function MonthTransitionStagger({
  month,
  children,
  className,
  staggerMs = 45,
}: {
  month: MonthSelection
  children: React.ReactNode
  className?: string
  staggerMs?: number
}) {
  const items = React.Children.toArray(children)
  return (
    <>
      {items.map((child, index) => (
        <MonthTransition
          key={index}
          month={month}
          delay={index * staggerMs}
          className={cn('contents', className)}
        >
          {child}
        </MonthTransition>
      ))}
    </>
  )
}
