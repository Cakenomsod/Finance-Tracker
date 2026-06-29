'use client'

import * as React from 'react'
import {
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
} from 'lucide-react'
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
  computePercentChange,
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

export default function DashboardPage() {
  const { user } = useAuth()
  const { profile } = useUserSettings()
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

  const overviewSection = (
    <>
      <RecurringDueCard />

      <MonthlySummaryCard
        monthKey={monthKey}
        monthDirection={monthDirection}
        selectedMonthLabel={monthLabel}
        currentTotals={currentTotals}
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Financial overview and spending insights.
            </p>
          </div>
          <MonthPicker
            value={selectedMonth}
            onChange={handleSelectedMonthChange}
            monthsWithData={monthsWithData}
          />
        </div>

        {overviewSection}

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
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 sm:gap-6 sm:p-6">
      {/* Page Header */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Financial overview and spending insights.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-start">
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

      {overviewSection}

      {/* Income vs Expenses & Insights */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>Monthly comparison from loaded history</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyOverview.length > 0 ? (
              <IncomeExpensesScrollChart
                data={monthlyOverview}
                hasOlderData={hasOlderChartData}
                loadingOlder={chartLoadingOlder}
                onLoadOlder={loadOlderChartData}
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                No transaction data yet
              </div>
            )}
          </CardContent>
        </Card>

        <InsightsPanel
          insights={insights}
          monthKey={monthKey}
          monthDirection={monthDirection}
        />
      </div>

      {/* Category breakdown */}
      <Card className="min-w-0 overflow-hidden">
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <CardTitle>
                  <MonthAnimatedValue valueKey={`${monthKey}-trend-title`} className="inline">
                    {isCurrentMonthSelection(selectedMonth)
                      ? 'Weekly Spending Trend'
                      : 'Weekday Spending Pattern'}
                  </MonthAnimatedValue>
                </CardTitle>
                <CardDescription>
                  <MonthAnimatedValue valueKey={`${monthKey}-weekday-desc`} className="inline">
                    {isCurrentMonthSelection(selectedMonth)
                      ? 'Daily spending pattern this week'
                      : `Spending by day of week in ${monthLabel}`}
                  </MonthAnimatedValue>
                </CardDescription>
              </div>
              {weekComparison.value !== 'New' && weekComparison.value !== '0%' && (
                <MonthAnimatedValue valueKey={`${monthKey}-week-badge`} className="inline-flex w-fit shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(
                      'w-fit shrink-0',
                      weekComparison.type === 'negative' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {weekComparison.type === 'negative' ? (
                      <TrendingDown className="mr-1 size-3" />
                    ) : (
                      <TrendingUp className="mr-1 size-3" />
                    )}
                    {weekComparison.value}{' '}
                    {isCurrentMonthSelection(selectedMonth) ? 'vs last week' : 'vs last month'}
                  </Badge>
                </MonthAnimatedValue>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
            {isCurrentMonthSelection(selectedMonth) ? (
              weeklySpendingTrend.some((d) => d.amount > 0) ? (
                <ChartContainer config={chartConfig} className="h-[250px] w-full">
                  <LineChart data={weeklySpendingTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                      dot={{ fill: 'var(--chart-1)', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
                  No spending this week yet
                </div>
              )
            ) : (
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
            )}
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
