'use client'

import * as React from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type MoneyInputProps = Omit<React.ComponentProps<'input'>, 'type'> & {
  currencySymbol: string
  /** Classes for the wrapper (width, grid placement). */
  wrapperClassName?: string
  symbolClassName?: string
}

const SYMBOL_LEFT_PX = 10
const SYMBOL_GAP_PX = 6

/**
 * Amount input with a currency prefix. Left padding follows the rendered symbol
 * width (฿ vs HK$ vs ﷼) so digits never slide under it on narrow screens.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { currencySymbol, className, wrapperClassName, symbolClassName, style, ...props },
  ref
) {
  const symbolRef = React.useRef<HTMLSpanElement>(null)
  const [symbolWidth, setSymbolWidth] = React.useState<number | null>(null)

  React.useLayoutEffect(() => {
    const el = symbolRef.current
    if (!el) return
    const measure = () => setSymbolWidth(el.getBoundingClientRect().width)
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [currencySymbol])

  const paddingLeft =
    symbolWidth != null
      ? `${Math.ceil(symbolWidth) + SYMBOL_LEFT_PX + SYMBOL_GAP_PX}px`
      : `calc(${Math.max(1, Array.from(currencySymbol).length) * 1.5}ch + 1rem)`

  return (
    <div className={cn('relative min-w-0', wrapperClassName)}>
      <span
        ref={symbolRef}
        aria-hidden
        className={cn(
          'pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-muted-foreground',
          symbolClassName
        )}
      >
        {currencySymbol}
      </span>
      <Input
        ref={ref}
        type="number"
        inputMode="decimal"
        className={cn('tabular-nums', className)}
        style={{ paddingLeft, ...style }}
        {...props}
      />
    </div>
  )
})
