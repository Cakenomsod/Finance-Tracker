'use client'

import { cn, amountColorClass } from '@/lib/utils'
import { formatMoney, formatMoneyPair } from '@/lib/aggregate-transactions'
import type { CurrencyBalanceRow } from '@/lib/account-balances'
import { sumCurrencyBalancesInHome } from '@/lib/account-balances'

interface CurrencyBreakdownProps {
  rows: CurrencyBalanceRow[]
  homeCurrency: string
  rates: Record<string, number>
  /** Show home total on the right of an optional header row */
  showHomeTotal?: boolean
  className?: string
}

/** Lists only currencies with non-zero balance: original amount + ≈ home. */
export function CurrencyBreakdown({
  rows,
  homeCurrency,
  rates,
  className,
}: CurrencyBreakdownProps) {
  if (rows.length === 0) return null

  return (
    <ul className={cn('mt-1.5 space-y-1 list-none p-0 m-0', className)}>
      {rows.map((row) => {
        const { primary, secondary } = formatMoneyPair(
          row.amount,
          row.currency,
          homeCurrency,
          rates
        )
        return (
          <li
            key={row.currency}
            className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground"
          >
            <span className="min-w-0 truncate font-medium tabular-nums text-foreground/80">
              {row.currency}
            </span>
            <span className="shrink-0 text-right tabular-nums">
              <span className={cn('text-foreground/90', amountColorClass(row.amount))}>
                {primary}
              </span>
              {secondary && (
                <span className="ml-1.5 text-[10px] text-muted-foreground">{secondary}</span>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function homeTotalLabel(
  rows: CurrencyBalanceRow[],
  homeCurrency: string,
  rates: Record<string, number>
): string {
  const total = sumCurrencyBalancesInHome(rows, homeCurrency, rates)
  return formatMoney(total, homeCurrency)
}
