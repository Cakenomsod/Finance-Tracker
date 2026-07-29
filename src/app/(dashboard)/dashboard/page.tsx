'use client'

import * as React from 'react'
import Link from 'next/link'
import { TrendingUp, TrendingDown } from 'lucide-react'
import {
  Bar,
  BarChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useAnalyticsData } from '@/hooks/use-analytics-data'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { useDebts } from '@/hooks/use-debts'
import { useTripsData } from '@/hooks/use-trips-data-context'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useQuickAdd } from '@/components/quick-add-context'
import { IncomeExpensesScrollChart } from '@/components/analytics/income-expenses-scroll-chart'
import { InsightsPanel } from '@/components/analytics/insights-panel'
import { RecurringDueCard } from '@/components/dashboard/recurring-due-card'
import { MonthlySummaryCard } from '@/components/dashboard/monthly-summary-card'
import { DebtSummaryCard } from '@/components/dashboard/debt-summary-card'
import { DashboardSkeleton } from '@/components/dashboard/dashboard-skeleton'
import { MonthPicker } from '@/components/shared/month-picker'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  useMonthTransition,
} from '@/components/shared/month-transition'
import {
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  getPreviousMonthSelection,
  formatMonthLabel,
  hasMonthData,
  isCurrentMonthSelection,
  type MonthSelection,
} from '@/lib/datetime'
import {
  buildMonthlyOverview,
  buildCategoryBreakdown,
  buildWeekdaySpending,
  buildDashboardInsights,
  collectMonthsWithData,
  filterByMonth,
  getDateFromTx,
  getCountedExpenseThb,
  getFinancialHabits as getLibFinancialHabits,
  getWeekSpendingComparison,
  computeMonthTotals,
  computeCumulativeBalanceUpToMonth,
  computePercentChange,
  mergeTransactions,
  formatMoney,
  type CombinedTransaction,
} from '@/lib/aggregate-transactions'
import { computeTotalLedgerBalanceUpToMonth } from '@/lib/account-balances'
import { usePaymentSources } from '@/hooks/use-payment-sources'
import { PaymentSource } from '@/lib/firestore-types'

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

function ChartEmpty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center px-4 text-center text-sm text-muted-foreground text-pretty">
      {children}
    </div>
  )
}

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
  const highestDay = daySums[highestDayIdx] > 0 ? dayNames[highestDayIdx] : '—'

  const catMap = new Map<string, number>()
  expenseTxs.forEach((tx) => {
    const cat = tx.category || 'Others'
    catMap.set(cat, (catMap.get(cat) || 0) + getCountedExpenseThb(tx))
  })
  let topCategory = '—'
  let topCategoryPct = 0
  if (catMap.size > 0) {
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
    topCategory = sorted[0][0]
    topCategoryPct = totalExpenses > 0 ? Math.round((sorted[0][1] / totalExpenses) * 100) : 0
  }

  const txCount = transactions.length

  return { avgDaily, highestDay, topCategory, topCategoryPct, txCount }
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { profile, accountsEnabled } = useUserSettings()
  const { activeSources } = usePaymentSources()

  const sourcesById = React.useMemo(() => {
    const map = new Map<string, PaymentSource>()
    for (const s of activeSources) {
      if (s.id) map.set(s.id, s)
    }
    return map
  }, [activeSources])
  const { openQuickAdd } = useQuickAdd()
  const [selectedMonth, setSelectedMonth] = React.useState(getCurrentMonthSelection)
  const { monthKey, direction: monthDirection, onMonthChange } = useMonthTransition(selectedMonth)

  const handleSelectedMonthChange = React.useCallback(
    (next: typeof selectedMonth) => onMonthChange(next, setSelectedMonth),
    [onMonthChange]
  )

  const { transactions: allTransactions } = useTransactions()
  const { allTripExpenses: fullTripExpenses } = useAllTripExpenses()
  const { combined, loading: analyticsLoading } = useAnalyticsData(user?.uid, selectedMonth)
  const {
    transactions: dashboardTransactions,
    tripExpenses: dashboardTripExpenses,
    loadOlderChartData,
    hasOlderChartData,
    chartLoadingOlder,
    loading: dashboardDataLoading,
  } = useDashboardData(user?.uid)
  const { debts, loading: debtLoading } = useDebts()
  const { tripDebts, loading: tripDebtLoading } = useTripsData()

  const currency = profile?.currency || 'THB'
  const loading = analyticsLoading || dashboardDataLoading || debtLoading || tripDebtLoading

  const historicalCombined = React.useMemo(
    () => mergeTransactions(dashboardTransactions, dashboardTripExpenses, user?.uid),
    [dashboardTransactions, dashboardTripExpenses, user?.uid]
  )

  const summaryCombined = React.useMemo(
    () => mergeTransactions(allTransactions, fullTripExpenses, user?.uid),
    [allTransactions, fullTripExpenses, user?.uid]
  )

  const selectedMonthTxs = React.useMemo(
    () => filterByMonth(historicalCombined, selectedMonth.year, selectedMonth.month),
    [historicalCombined, selectedMonth]
  )
  const previousMonthSelection = React.useMemo(
    () => getPreviousMonthSelection(selectedMonth),
    [selectedMonth]
  )
  const previousMonthTxs = React.useMemo(
    () => filterByMonth(historicalCombined, previousMonthSelection.year, previousMonthSelection.month),
    [historicalCombined, previousMonthSelection]
  )

  const currentTotals = React.useMemo(() => computeMonthTotals(selectedMonthTxs), [selectedMonthTxs])
  const previousTotals = React.useMemo(() => computeMonthTotals(previousMonthTxs), [previousMonthTxs])
  const cumulativeBalance = React.useMemo(() => {
    if (accountsEnabled && activeSources.length > 0) {
      return computeTotalLedgerBalanceUpToMonth(
        allTransactions,
        activeSources,
        sourcesById,
        selectedMonth.year,
        selectedMonth.month
      )
    }
    return computeCumulativeBalanceUpToMonth(
      summaryCombined,
      selectedMonth.year,
      selectedMonth.month
    )
  }, [
    accountsEnabled,
    activeSources,
    sourcesById,
    allTransactions,
    summaryCombined,
    selectedMonth,
  ])

  const netChange = React.useMemo(
    () => computePercentChange(currentTotals.net, previousTotals.net),
    [currentTotals.net, previousTotals.net]
  )
  const incomeChange = React.useMemo(
    () => computePercentChange(currentTotals.income, previousTotals.income),
    [currentTotals.income, previousTotals.income]
  )
  const expenseChange = React.useMemo(
    () => computePercentChange(currentTotals.expenses, previousTotals.expenses),
    [currentTotals.expenses, previousTotals.expenses]
  )
  const savingsChange = React.useMemo(
    () => computePercentChange(currentTotals.savingsRate, previousTotals.savingsRate),
    [currentTotals.savingsRate, previousTotals.savingsRate]
  )

  const debtSummary = React.useMemo(() => {
    const manualPending = debts.filter((d) => d.status === 'pending')

    const mappedTripDebts = tripDebts.map((td) => {
      if (td.amount > 0) {
        return {
          fromUserId: td.personId,
          toUserId: user!.uid,
          amount: td.amount,
        }
      }
      return {
        fromUserId: user!.uid,
        toUserId: td.personId,
        amount: Math.abs(td.amount),
      }
    })

    const allPending = [
      ...manualPending.map((d) => ({ fromUserId: d.fromUserId, toUserId: d.toUserId, amount: d.amount })),
      ...mappedTripDebts,
    ]

    const youOwe = allPending.filter((d) => d.fromUserId === user?.uid)
    const owedToYou = allPending.filter((d) => d.toUserId === user?.uid)

    const totalOwed = youOwe.reduce((sum, d) => sum + d.amount, 0)
    const totalOwedToYou = owedToYou.reduce((sum, d) => sum + d.amount, 0)
    const netBalance = totalOwedToYou - totalOwed

    const uniqueOwePeople = new Set(youOwe.map((d) => d.toUserId)).size
    const uniqueOwedPeople = new Set(owedToYou.map((d) => d.fromUserId)).size

    return { totalOwed, totalOwedToYou, netBalance, uniqueOwePeople, uniqueOwedPeople }
  }, [debts, tripDebts, user])

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
    () => buildMonthlyOverview(historicalCombined),
    [historicalCombined]
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
  const weeklySpendingTrend = React.useMemo(
    () =>
      isCurrentMonthSelection(selectedMonth)
        ? buildWeekdaySpending(historicalCombined)
        : buildWeekdayPattern(combined, selectedMonth).map((d) => ({
            day: d.day,
            amount: d.thisWeek,
          })),
    [historicalCombined, combined, selectedMonth]
  )
  const weekComparison = React.useMemo(() => {
    if (isCurrentMonthSelection(selectedMonth)) {
      return getWeekSpendingComparison(historicalCombined)
    }
    const thisMonthExpenses = combined.reduce((s, tx) => s + getCountedExpenseThb(tx), 0)
    const prevMonth = selectedMonth.month === 0
      ? { year: selectedMonth.year - 1, month: 11 }
      : { year: selectedMonth.year, month: selectedMonth.month - 1 }
    const prevMonthTxs = historicalCombined.filter((tx) => {
      const d = getDateFromTx(tx)
      return d.getMonth() === prevMonth.month && d.getFullYear() === prevMonth.year
    })
    const prevMonthExpenses = prevMonthTxs.reduce((s, tx) => s + getCountedExpenseThb(tx), 0)
    return computePercentChange(thisMonthExpenses, prevMonthExpenses)
  }, [historicalCombined, combined, selectedMonth])
  const insights = React.useMemo(
    () => buildDashboardInsights(combined, getLibFinancialHabits(combined)),
    [combined]
  )
  const habits = React.useMemo(
    () => getFinancialHabits(combined, selectedMonth),
    [combined, selectedMonth]
  )

  if (loading) {
    return <DashboardSkeleton />
  }

  const pageHeader = (
    <header className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight text-balance sm:text-2xl">
          Dashboard
        </h1>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          Balance, shared money, and spending patterns for {monthLabel}.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-start">
        <MonthPicker
          value={selectedMonth}
          onChange={handleSelectedMonthChange}
          monthsWithData={monthsWithData}
        />
      </div>
    </header>
  )

  const overviewSection = (
    <>
      <RecurringDueCard />

      <MonthlySummaryCard
        monthKey={monthKey}
        monthDirection={monthDirection}
        selectedMonthLabel={monthLabel}
        currentTotals={currentTotals}
        cumulativeBalance={cumulativeBalance}
        netChange={netChange}
        incomeChange={incomeChange}
        expenseChange={expenseChange}
        savingsChange={savingsChange}
        currency={currency}
      />

      <DebtSummaryCard
        totalOwed={debtSummary.totalOwed}
        totalOwedToYou={debtSummary.totalOwedToYou}
        netBalance={debtSummary.netBalance}
        uniqueOwePeople={debtSummary.uniqueOwePeople}
        uniqueOwedPeople={debtSummary.uniqueOwedPeople}
        currency={currency}
      />
    </>
  )

  if (combined.length === 0 && !loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6">
        {pageHeader}
        {overviewSection}

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center px-6 py-12 text-center">
            <p className="text-base font-medium text-balance">
              No transactions in {monthLabel}
            </p>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground text-pretty">
              Log an expense or income to unlock charts, category breakdowns, and spending habits
              for this month.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button onClick={openQuickAdd}>Add a transaction</Button>
              <Button variant="outline" asChild>
                <Link href="/transactions">View transactions</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 sm:gap-6 sm:p-6">
      {pageHeader}

      {overviewSection}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-balance">Income vs expenses</CardTitle>
            <CardDescription className="text-pretty">
              Monthly comparison from loaded history
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            {monthlyOverview.length > 0 ? (
              <IncomeExpensesScrollChart
                data={monthlyOverview}
                hasOlderData={hasOlderChartData}
                loadingOlder={chartLoadingOlder}
                onLoadOlder={loadOlderChartData}
              />
            ) : (
              <ChartEmpty>No monthly history yet. Add transactions to compare months.</ChartEmpty>
            )}
          </CardContent>
        </Card>

        <InsightsPanel
          insights={insights}
          monthKey={monthKey}
          monthDirection={monthDirection}
        />
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-balance">Spending by category</CardTitle>
          <CardDescription className="text-pretty">
            Where {monthLabel} expenses went
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            {categoryBreakdown.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 md:items-start">
                <ChartContainer config={chartConfig} className="mx-auto h-[200px] w-full max-w-[280px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={categoryBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={56}
                      outerRadius={88}
                      paddingAngle={2}
                    >
                      {categoryBreakdown.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={categoryColors[index % categoryColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="space-y-3" role="list" aria-label="Category ranking">
                  {categoryBreakdown.slice(0, 6).map((category, index) => {
                    const maxValue = categoryBreakdown[0]?.value || 1
                    const barWidth = Math.round((category.value / maxValue) * 100)
                    return (
                      <div key={category.name} role="listitem">
                        <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                          <div className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: categoryColors[index % categoryColors.length],
                              }}
                              aria-hidden
                            />
                            <span className="truncate">{category.name}</span>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-muted-foreground tabular-nums">
                              {formatMoney(category.value, currency)}
                            </span>
                            <Badge variant="secondary" className="tabular-nums text-xs">
                              {category.percentage}%
                            </Badge>
                          </div>
                        </div>
                        <Progress
                          value={barWidth}
                          className="h-1.5"
                          aria-label={`${category.name} ${category.percentage}% of expenses`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <ChartEmpty>
                No expenses this month. Log a purchase to see category breakdown.
              </ChartEmpty>
            )}
          </MonthContentTransition>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle className="text-balance">
                  <MonthAnimatedValue valueKey={`${monthKey}-trend-title`} className="inline">
                    {isCurrentMonthSelection(selectedMonth)
                      ? 'Weekly spending'
                      : 'Weekday pattern'}
                  </MonthAnimatedValue>
                </CardTitle>
                <CardDescription className="text-pretty">
                  <MonthAnimatedValue valueKey={`${monthKey}-weekday-desc`} className="inline">
                    {isCurrentMonthSelection(selectedMonth)
                      ? 'Daily spending this week'
                      : `By day of week in ${monthLabel}`}
                  </MonthAnimatedValue>
                </CardDescription>
              </div>
              {weekComparison.value !== 'New' && weekComparison.value !== '0%' && (
                <MonthAnimatedValue
                  valueKey={`${monthKey}-week-badge`}
                  className="inline-flex w-fit shrink-0"
                >
                  <Badge
                    variant="secondary"
                    className={cn(
                      'w-fit shrink-0 tabular-nums',
                      weekComparison.type === 'negative'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {weekComparison.type === 'negative' ? (
                      <TrendingDown className="mr-1 size-3" aria-hidden />
                    ) : (
                      <TrendingUp className="mr-1 size-3" aria-hidden />
                    )}
                    {weekComparison.value}{' '}
                    {isCurrentMonthSelection(selectedMonth) ? 'vs last week' : 'vs last month'}
                  </Badge>
                </MonthAnimatedValue>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
              {isCurrentMonthSelection(selectedMonth) ? (
                weeklySpendingTrend.some((d) => d.amount > 0) ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <LineChart
                      data={weeklySpendingTrend}
                      margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        width={48}
                        tickFormatter={(value) =>
                          value >= 1000 ? `฿${Math.round(value / 1000)}k` : `฿${value}`
                        }
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
                  <ChartEmpty>No spending this week yet.</ChartEmpty>
                )
              ) : (
                weekdayPattern.some((d) => d.thisWeek > 0) ? (
                  <ChartContainer config={chartConfig} className="h-[250px] w-full">
                    <BarChart
                      data={weekdayPattern}
                      margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        className="stroke-border"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="day"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-muted-foreground"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={4}
                        width={48}
                        tickFormatter={(value) =>
                          value >= 1000 ? `฿${Math.round(value / 1000)}k` : `฿${value}`
                        }
                        className="text-xs fill-muted-foreground"
                      />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar
                        dataKey="thisWeek"
                        fill="var(--chart-1)"
                        radius={[4, 4, 0, 0]}
                        name="Spending"
                      />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <ChartEmpty>No weekday spending in {monthLabel}.</ChartEmpty>
                )
              )}
            </MonthContentTransition>
          </CardContent>
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-balance">Daily spending</CardTitle>
            <CardDescription className="text-pretty">
              Day-by-day pattern for{' '}
              <MonthAnimatedValue valueKey={`${monthKey}-daily-desc`} className="inline">
                {monthLabel}
              </MonthAnimatedValue>
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
              {dailySpending.length > 0 ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <LineChart
                    data={dailySpending}
                    margin={{ top: 12, right: 8, left: 4, bottom: 4 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-border"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="day"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickMargin={4}
                      width={48}
                      tickFormatter={(value) =>
                        value >= 1000 ? `฿${Math.round(value / 1000)}k` : `฿${value}`
                      }
                      className="text-xs fill-muted-foreground"
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line
                      type="monotone"
                      dataKey="amount"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={{ fill: 'var(--chart-1)', r: 2.5 }}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <ChartEmpty>No daily spending recorded for {monthLabel}.</ChartEmpty>
              )}
            </MonthContentTransition>
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 overflow-hidden">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="text-balance">Habits at a glance</CardTitle>
          <CardDescription className="text-pretty">
            Snapshot of how you spent in {monthLabel}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            <dl className="grid gap-0 divide-y divide-border sm:grid-cols-2 sm:gap-x-8 sm:divide-y-0">
              <div className="flex items-baseline justify-between gap-4 py-3 sm:border-b sm:border-border sm:py-3.5">
                <dt className="text-sm text-muted-foreground">Avg. daily spending</dt>
                <dd>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-avg-daily`}
                    className="text-sm font-semibold tabular-nums"
                  >
                    {formatMoney(habits.avgDaily, currency)}
                  </MonthAnimatedValue>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3 sm:border-b sm:border-border sm:py-3.5">
                <dt className="text-sm text-muted-foreground">Highest spending day</dt>
                <dd>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-highest-day`}
                    className="text-sm font-semibold"
                  >
                    {habits.highestDay}
                  </MonthAnimatedValue>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3 sm:py-3.5">
                <dt className="text-sm text-muted-foreground">Top category</dt>
                <dd className="min-w-0 text-right">
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-top-cat`}
                    className="block truncate text-sm font-semibold"
                  >
                    {habits.topCategory}
                  </MonthAnimatedValue>
                  {habits.topCategoryPct > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {habits.topCategoryPct}% of expenses
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-3 sm:py-3.5">
                <dt className="text-sm text-muted-foreground">Transactions</dt>
                <dd>
                  <MonthAnimatedValue
                    valueKey={`${monthKey}-habit-tx`}
                    className="text-sm font-semibold tabular-nums"
                  >
                    {habits.txCount}
                  </MonthAnimatedValue>
                </dd>
              </div>
            </dl>
          </MonthContentTransition>
        </CardContent>
      </Card>
    </div>
  )
}
