'use client'

import * as React from 'react'
import {
  TrendingUp,
  TrendingDown,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  PiggyBank,
  BarChart3,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useAnalyticsData } from '@/hooks/use-analytics-data'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions'
import { MonthPicker } from '@/components/shared/month-picker'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  useMonthTransition,
} from '@/components/shared/month-transition'
import {
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  formatMonthLabel,
  hasMonthData,
  type MonthSelection,
} from '@/lib/datetime'
import {
  buildMonthlyOverview,
  buildCategoryBreakdown,
  collectMonthsWithData,
  getDateFromTx,
  getCountedExpenseThb,
  computeMonthTotals,
  mergeTransactions,
  type CombinedTransaction,
} from '@/lib/aggregate-transactions'

const chartConfig = {
  income: { label: 'Income', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-3)' },
  savings: { label: 'Savings', color: 'var(--chart-2)' },
  amount: { label: 'Amount', color: 'var(--chart-1)' },
  thisWeek: { label: 'This Week', color: 'var(--chart-1)' },
  average: { label: 'Average', color: 'var(--chart-4)' },
}

const categoryColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--primary)',
  'var(--muted-foreground)',
]

function buildDailySpending(transactions: CombinedTransaction[], month: MonthSelection) {
  const dayMap = new Map<number, number>()

  transactions
    .filter((tx) => tx.amountThb < 0)
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      if (d.getMonth() === month.month && d.getFullYear() === month.year) {
        const day = d.getDate()
        dayMap.set(day, (dayMap.get(day) || 0) + Math.abs(tx.amountThb))
      }
    })

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, amount]) => ({
      day: String(day),
      amount: Math.round(amount),
    }))
}

function buildWeekdayPattern(transactions: CombinedTransaction[], month: MonthSelection) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const monthSums = new Array(7).fill(0)

  transactions
    .filter((tx) => tx.amountThb < 0)
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      if (d.getMonth() === month.month && d.getFullYear() === month.year) {
        monthSums[d.getDay()] += Math.abs(tx.amountThb)
      }
    })

  const ordered = [1, 2, 3, 4, 5, 6, 0]
  return ordered.map((idx) => ({
    day: dayNames[idx],
    thisWeek: Math.round(monthSums[idx]),
    average: 0,
  }))
}

function getFinancialHabits(transactions: CombinedTransaction[], month: MonthSelection) {
  const expenseTxs = transactions.filter((tx) => getCountedExpenseThb(tx) > 0)
  const totalExpenses = expenseTxs.reduce((s, tx) => s + getCountedExpenseThb(tx), 0)

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate()
  const avgDaily = daysInMonth > 0 ? Math.round(totalExpenses / daysInMonth) : 0

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daySums = new Array(7).fill(0)
  expenseTxs.forEach((tx) => {
    const d = getDateFromTx(tx)
    daySums[d.getDay()] += getCountedExpenseThb(tx)
  })
  const highestDayIdx = daySums.indexOf(Math.max(...daySums))
  const highestDay = daySums[highestDayIdx] > 0 ? dayNames[highestDayIdx] : '-'

  const catMap = new Map<string, number>()
  expenseTxs.forEach((tx) => {
    const cat = tx.category || 'Others'
    catMap.set(cat, (catMap.get(cat) || 0) + getCountedExpenseThb(tx))
  })
  let topCategory = '-'
  let topCategoryPct = 0
  if (catMap.size > 0) {
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
    topCategory = sorted[0][0]
    topCategoryPct = totalExpenses > 0 ? Math.round((sorted[0][1] / totalExpenses) * 100) : 0
  }

  const txCount = transactions.length

  return { avgDaily, highestDay, topCategory, topCategoryPct, txCount }
}

export default function AnalyticsPage() {
  const { user } = useAuth()
  const [selectedMonth, setSelectedMonth] = React.useState(getCurrentMonthSelection)
  const { monthKey, direction: monthDirection, onMonthChange } = useMonthTransition(selectedMonth)

  const handleSelectedMonthChange = React.useCallback(
    (next: typeof selectedMonth) => onMonthChange(next, setSelectedMonth),
    [onMonthChange]
  )

  const { transactions: allTransactions } = useTransactions()
  const { allTripExpenses: fullTripExpenses } = useAllTripExpenses()
  const { combined, loading } = useAnalyticsData(user?.uid, selectedMonth)

  const summaryCombined = React.useMemo(
    () => mergeTransactions(allTransactions, fullTripExpenses, user?.uid),
    [allTransactions, fullTripExpenses, user?.uid]
  )

  const monthsWithData = React.useMemo(
    () => collectMonthsWithData(summaryCombined),
    [summaryCombined]
  )

  React.useEffect(() => {
    if (monthsWithData.size === 0) return
    if (!hasMonthData(monthsWithData, selectedMonth)) {
      const latest = getLatestAvailableMonth(monthsWithData)
      if (latest) setSelectedMonth(latest)
    }
  }, [monthsWithData, selectedMonth])

  const monthLabel = formatMonthLabel(selectedMonth)

  const monthlyOverview = React.useMemo(
    () => buildMonthlyOverview(combined),
    [combined]
  )
  const categoryBreakdown = React.useMemo(
    () => buildCategoryBreakdown(combined),
    [combined]
  )
  const dailySpending = React.useMemo(
    () => buildDailySpending(combined, selectedMonth),
    [combined, selectedMonth]
  )
  const weekdayPattern = React.useMemo(
    () => buildWeekdayPattern(combined, selectedMonth),
    [combined, selectedMonth]
  )
  const habits = React.useMemo(
    () => getFinancialHabits(combined, selectedMonth),
    [combined, selectedMonth]
  )

  const monthTotals = React.useMemo(() => computeMonthTotals(combined), [combined])
  const totalIncome = monthTotals.income
  const totalExpenses = monthTotals.expenses
  const totalSavings = monthTotals.net
  const avgSavingsRate = monthTotals.savingsRate

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <BarChart3 className="mx-auto size-8 animate-pulse text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (combined.length === 0 && !loading) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground">
              Detailed financial insights and spending analysis.
            </p>
          </div>
          <MonthPicker
            value={selectedMonth}
            onChange={handleSelectedMonthChange}
            monthsWithData={monthsWithData}
          />
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No transaction data for {monthLabel}</p>
            <p className="text-sm text-muted-foreground">
              Try selecting a different month or add some transactions
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Detailed financial insights and spending analysis.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <MonthPicker
            value={selectedMonth}
            onChange={handleSelectedMonthChange}
            monthsWithData={monthsWithData}
          />
          <Button variant="outline" size="icon">
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <MonthContentTransition
        monthKey={monthKey}
        direction={monthDirection}
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '0ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="size-4 text-success" />
              Total Income
            </div>
            <MonthAnimatedValue valueKey={`${monthKey}-income`} className="mt-2 block text-2xl font-bold text-success">
              ฿{totalIncome.toLocaleString()}
            </MonthAnimatedValue>
            <p className="mt-1 text-xs text-muted-foreground">
              <MonthAnimatedValue valueKey={`${monthKey}-label`} className="inline">
                {monthLabel}
              </MonthAnimatedValue>
            </p>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '45ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="size-4 text-destructive" />
              Total Expenses
            </div>
            <MonthAnimatedValue valueKey={`${monthKey}-expenses`} className="mt-2 block text-2xl font-bold text-destructive">
              ฿{totalExpenses.toLocaleString()}
            </MonthAnimatedValue>
            <p className="mt-1 text-xs text-muted-foreground">
              <MonthAnimatedValue valueKey={`${monthKey}-tx-count`} className="inline">
                {habits.txCount} transactions in {monthLabel}
              </MonthAnimatedValue>
            </p>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '90ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="size-4 text-primary" />
              Net Savings
            </div>
            <MonthAnimatedValue
              valueKey={`${monthKey}-savings`}
              className={cn('mt-2 block text-2xl font-bold', totalSavings >= 0 ? 'text-success' : 'text-destructive')}
            >
              {totalSavings >= 0 ? '+' : ''}฿{totalSavings.toLocaleString()}
            </MonthAnimatedValue>
            <p className="mt-1 text-xs text-muted-foreground">
              Income minus expenses
            </p>
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '135ms' }}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="size-4" />
              Savings Rate
            </div>
            <MonthAnimatedValue valueKey={`${monthKey}-rate`} className="mt-2 block text-2xl font-bold">
              {avgSavingsRate}%
            </MonthAnimatedValue>
            <Progress value={Math.max(0, avgSavingsRate)} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </MonthContentTransition>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Overview</CardTitle>
            <CardDescription>
              Income and expenses for{' '}
              <MonthAnimatedValue valueKey={`${monthKey}-cashflow-desc`} className="inline">
                {monthLabel}
              </MonthAnimatedValue>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            {monthlyOverview.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <AreaChart data={monthlyOverview} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  <Area
                    type="monotone"
                    dataKey="income"
                    stroke="var(--chart-1)"
                    fill="var(--chart-1)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expenses"
                    stroke="var(--chart-3)"
                    fill="var(--chart-3)"
                    fillOpacity={0.2}
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No data for the selected period
              </div>
            )}
            </MonthContentTransition>
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Expense breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            {categoryBreakdown.length > 0 ? (
              <>
                <ChartContainer config={chartConfig} className="mx-auto h-[180px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={categoryColors[index % categoryColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-4 space-y-2">
                  {categoryBreakdown.slice(0, 5).map((cat, index) => (
                    <div key={cat.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                        />
                        <span className="truncate max-w-[120px]">{cat.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">
                          ฿{cat.value.toLocaleString()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {cat.percentage}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-[180px] text-muted-foreground">
                No expense data
              </div>
            )}
            </MonthContentTransition>
          </CardContent>
        </Card>
      </div>

      {/* Category Details and Patterns */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Category Ranking</CardTitle>
            <CardDescription>Your highest spending categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            {categoryBreakdown.length > 0 ? (
              categoryBreakdown.slice(0, 6).map((category, index) => {
                const maxValue = categoryBreakdown[0]?.value || 1
                const barWidth = Math.round((category.value / maxValue) * 100)
                return (
                  <div key={category.name}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: categoryColors[index % categoryColors.length] }}
                        />
                        <span>{category.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground tabular-nums">
                          ฿{category.value.toLocaleString()}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {category.percentage}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={barWidth} className="h-2" />
                  </div>
                )
              })
            ) : (
              <div className="text-center text-muted-foreground py-8">No expense data</div>
            )}
            </MonthContentTransition>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekday Spending Pattern</CardTitle>
            <CardDescription>
              Spending by day of week in{' '}
              <MonthAnimatedValue valueKey={`${monthKey}-weekday-desc`} className="inline">
                {monthLabel}
              </MonthAnimatedValue>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={weekdayPattern} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `฿${value}`}
                  className="text-xs fill-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="thisWeek" fill="var(--chart-1)" radius={[4, 4, 0, 0]} name="Spending" />
              </BarChart>
            </ChartContainer>
            </MonthContentTransition>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Trend</CardTitle>
          <CardDescription>
            Spending pattern for{' '}
            <MonthAnimatedValue valueKey={`${monthKey}-daily-desc`} className="inline">
              {monthLabel}
            </MonthAnimatedValue>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
          {dailySpending.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px] w-full">
              <LineChart data={dailySpending} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis
                  dataKey="day"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-muted-foreground"
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => `฿${value}`}
                  className="text-xs fill-muted-foreground"
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="amount"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--chart-1)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No spending data for this month yet
            </div>
          )}
          </MonthContentTransition>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Financial Habits Summary</CardTitle>
          <CardDescription>Key insights from your spending patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthContentTransition
            monthKey={monthKey}
            direction={monthDirection}
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="rounded-lg bg-muted p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '0ms' }}>
              <p className="text-sm text-muted-foreground">Avg. Daily Spending</p>
              <MonthAnimatedValue valueKey={`${monthKey}-avg-daily`} className="mt-1 block text-2xl font-bold">
                ฿{habits.avgDaily.toLocaleString()}
              </MonthAnimatedValue>
              <p className="text-xs text-muted-foreground mt-1">Average for {monthLabel}</p>
            </div>
            <div className="rounded-lg bg-muted p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '45ms' }}>
              <p className="text-sm text-muted-foreground">Highest Spending Day</p>
              <MonthAnimatedValue valueKey={`${monthKey}-highest-day`} className="mt-1 block text-2xl font-bold">
                {habits.highestDay}
              </MonthAnimatedValue>
              <p className="text-xs text-muted-foreground mt-1">Day with most spending</p>
            </div>
            <div className="rounded-lg bg-muted p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '90ms' }}>
              <p className="text-sm text-muted-foreground">Top Category</p>
              <MonthAnimatedValue valueKey={`${monthKey}-top-cat`} className="mt-1 block truncate text-2xl font-bold">
                {habits.topCategory}
              </MonthAnimatedValue>
              <p className="text-xs text-muted-foreground mt-1">{habits.topCategoryPct}% of total expenses</p>
            </div>
            <div className="rounded-lg bg-muted p-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none" style={{ animationDelay: '135ms' }}>
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <MonthAnimatedValue valueKey={`${monthKey}-habit-tx`} className="mt-1 block text-2xl font-bold">
                {habits.txCount}
              </MonthAnimatedValue>
              <p className="text-xs text-muted-foreground mt-1">In {monthLabel}</p>
            </div>
          </MonthContentTransition>
        </CardContent>
      </Card>
    </div>
  )
}
