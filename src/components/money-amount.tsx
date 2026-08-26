'use client'

import { cn } from '@/lib/utils'
import { formatMoneyPair } from '@/lib/aggregate-transactions'

interface MoneyAmountProps {
  /** Raw amount (positive = income, negative = expense). */
  amount: number
  /** ISO 4217 code as recorded in the transaction. */
  currency: string
  /** User's current preference currency. */
  preferenceCurrency: string
  /** Live FX rates (USD = 1 base). Pass an empty object to use static fallbacks. */
  rates: Record<string, number>
  /** When true, prefix + or − sign. */
  showSign?: boolean
  /**
   * When true (trip context), show the preference-converted amount as the
   * primary value instead of the recorded amount.
   */
  forcePreference?: boolean
  className?: string
  secondaryClassName?: string
}

/**
 * Presentational component for a monetary amount with optional secondary
 * converted amount when the recorded currency differs from the user preference.
 */
export function MoneyAmount({
  amount,
  currency,
  preferenceCurrency,
  rates,
  showSign,
  forcePreference,
  className,
  secondaryClassName,
}: MoneyAmountProps) {
  const { primary, secondary } = formatMoneyPair(
    amount,
    currency,
    preferenceCurrency,
    rates,
    { showSign, forceHomeDisplay: forcePreference }
  )

  return (
    <span className={cn('inline-flex flex-col items-end tabular-nums', className)}>
      <span>{primary}</span>
      {secondary && (
        <span
          className={cn(
            'text-[10px] font-normal text-muted-foreground',
            secondaryClassName
          )}
        >
          {secondary}
        </span>
      )}
    </span>
  )
}
