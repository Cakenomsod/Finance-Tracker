'use client'

import type * as React from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  type MonthDirection,
} from '@/components/shared/month-transition'
import {
  computeMonthTotals,
  computePercentChange,
  formatMoney,
} from '@/lib/aggregate-transactions'

function ChangeBadge({
  change,
  changeType,
  valueKey,
}: {
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  valueKey: string
}) {
  return (
    <MonthAnimatedValue valueKey={valueKey} className="inline-flex">
      <Badge
        variant="secondary"
        className={cn(
          'text-xs font-medium tabular-nums',
          changeType === 'positive' && 'bg-primary/10 text-primary',
          changeType === 'negative' && 'bg-destructive/10 text-destructive'
        )}
      >
        {changeType === 'positive' ? (
          <TrendingUp className="mr-1 size-3" aria-hidden />
        ) : changeType === 'negative' ? (
          <TrendingDown className="mr-1 size-3" aria-hidden />
        ) : null}
        {change}
      </Badge>
    </MonthAnimatedValue>
  )
}

function SecondaryStat({
  label,
  value,
  valueKey,
  change,
  changeType,
}: {
  label: string
  value: string
  valueKey: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <MonthAnimatedValue
        valueKey={valueKey}
        className="block truncate text-lg font-semibold tabular-nums sm:text-xl"
      >
        {value}
      </MonthAnimatedValue>
      <ChangeBadge change={change} changeType={changeType} valueKey={`${valueKey}-change`} />
    </div>
  )
}

export function MonthlySummaryCard({
  monthKey,
  monthDirection,
  selectedMonthLabel,
  currentTotals,
  cumulativeBalance,
  netChange,
  incomeChange,
  expenseChange,
  savingsChange,
  currency,
  balanceFilterSlot,
}: {
  monthKey: string
  monthDirection: MonthDirection
  selectedMonthLabel: string
  currentTotals: ReturnType<typeof computeMonthTotals>
  cumulativeBalance: number
  netChange: ReturnType<typeof computePercentChange>
  incomeChange: ReturnType<typeof computePercentChange>
  expenseChange: ReturnType<typeof computePercentChange>
  savingsChange: ReturnType<typeof computePercentChange>
  currency: string
  balanceFilterSlot?: React.ReactNode
}) {
  return (
    <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
      <Card className="min-w-0 overflow-hidden">
        <CardContent className="p-4 sm:p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">
              Total in accounts
              <span className="font-normal text-muted-foreground">
                {' '}
                · through {selectedMonthLabel}
              </span>
            </p>
            <MonthAnimatedValue
              valueKey={`${monthKey}-balance`}
              className={cn(
                'block truncate text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl',
                cumulativeBalance >= 0 ? 'text-foreground' : 'text-destructive'
              )}
            >
              {formatMoney(cumulativeBalance, currency)}
            </MonthAnimatedValue>
            <p className="pt-1 text-xs text-muted-foreground">
              Net this month:{' '}
              <MonthAnimatedValue
                valueKey={`${monthKey}-net-inline`}
                className={cn(
                  'inline font-medium tabular-nums',
                  currentTotals.net >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatMoney(currentTotals.net, currency, true)}
              </MonthAnimatedValue>
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <ChangeBadge
                change={netChange.value}
                changeType={netChange.type}
                valueKey={`${monthKey}-net-change`}
              />
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
            {balanceFilterSlot ? <div className="pt-2">{balanceFilterSlot}</div> : null}
          </div>

          <div
            className="mt-6 grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-3 sm:gap-6"
            role="group"
            aria-label="Month income, expenses, and savings"
          >
            <SecondaryStat
              label="Income"
              valueKey={`${monthKey}-income`}
              value={formatMoney(currentTotals.income, currency)}
              change={incomeChange.value}
              changeType={incomeChange.type}
            />
            <SecondaryStat
              label="Expenses"
              valueKey={`${monthKey}-expenses`}
              value={formatMoney(currentTotals.expenses, currency)}
              change={expenseChange.value}
              changeType={
                expenseChange.type === 'positive'
                  ? 'negative'
                  : expenseChange.type === 'negative'
                    ? 'positive'
                    : 'neutral'
              }
            />
            <SecondaryStat
              label="Savings rate"
              valueKey={`${monthKey}-savings`}
              value={`${currentTotals.savingsRate}%`}
              change={savingsChange.value}
              changeType={savingsChange.type}
            />
          </div>
        </CardContent>
      </Card>
    </MonthContentTransition>
  )
}
