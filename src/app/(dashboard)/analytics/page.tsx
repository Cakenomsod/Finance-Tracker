'use client'

import * as React from 'react'
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  PiggyBank,
  CreditCard,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks/use-transactions'
import { Transaction } from '@/lib/firestore-types'

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

// --- Helper functions to aggregate transaction data ---

function getDateFromTx(tx: Transaction): Date {
  if (tx.date?.seconds) {
    return new Date(tx.date.seconds * 1000)
  }
  return new Date()
}

function filterByTimeRange(transactions: Transaction[], range: string): Transaction[] {
  const now = new Date()
  let cutoff: Date

  switch (range) {
    case '1month':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate())
      break
    case '3months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
      break
    case '6months':
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
      break
    case '1year':
      cutoff = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      break
    default:
      cutoff = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate())
  }

  return transactions.filter((tx) => getDateFromTx(tx) >= cutoff)
}

function buildMonthlyOverview(transactions: Transaction[]) {
  const monthMap = new Map<string, { income: number; expenses: number }>()

  transactions.forEach((tx) => {
    const d = getDateFromTx(tx)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    if (!monthMap.has(key)) {
      monthMap.set(key, { income: 0, expenses: 0 })
    }
    const entry = monthMap.get(key)!
    if (tx.amount > 0) {
      entry.income += tx.amount
    } else {
      entry.expenses += Math.abs(tx.amount)
    }
  })

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, data]) => {
      const monthIndex = parseInt(key.split('-')[1], 10) - 1
      return {
        month: monthNames[monthIndex],
        income: Math.round(data.income),
        expenses: Math.round(data.expenses),
        savings: Math.round(data.income - data.expenses),
      }
    })
}

function buildCategoryBreakdown(transactions: Transaction[]) {
  const catMap = new Map<string, number>()

  transactions
    .filter((tx) => tx.amount < 0) // expenses only
    .forEach((tx) => {
      const cat = tx.category || 'Others'
      catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amount))
    })

  const totalExpenses = Array.from(catMap.values()).reduce((s, v) => s + v, 0)

  return Array.from(catMap.entries())
    .map(([name, value]) => ({
      name,
      value: Math.round(value),
      percentage: totalExpenses > 0 ? Math.round((value / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value)
}

function buildDailySpending(transactions: Transaction[]) {
  // Current month only
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  const dayMap = new Map<number, number>()

  transactions
    .filter((tx) => tx.amount < 0) // expenses only
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        const day = d.getDate()
        dayMap.set(day, (dayMap.get(day) || 0) + Math.abs(tx.amount))
      }
    })

  return Array.from(dayMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, amount]) => ({
      day: String(day),
      amount: Math.round(amount),
    }))
}

function buildWeekdayPattern(transactions: Transaction[]) {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const daySums = new Array(7).fill(0)
  const dayCounts = new Array(7).fill(0)

  // Current week
  const now = new Date()
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay()) // Sunday
  startOfWeek.setHours(0, 0, 0, 0)

  const thisWeekSums = new Array(7).fill(0)

  transactions
    .filter((tx) => tx.amount < 0) // expenses only
    .forEach((tx) => {
      const d = getDateFromTx(tx)
      const dayOfWeek = d.getDay()
      daySums[dayOfWeek] += Math.abs(tx.amount)
      dayCounts[dayOfWeek] += 1

      if (d >= startOfWeek) {
        thisWeekSums[dayOfWeek] += Math.abs(tx.amount)
      }
    })

  // Reorder: Mon-Sun
  const ordered = [1, 2, 3, 4, 5, 6, 0]
  return ordered.map((idx) => ({
    day: dayNames[idx],
    thisWeek: Math.round(thisWeekSums[idx]),
    average: dayCounts[idx] > 0 ? Math.round(daySums[idx] / dayCounts[idx]) : 0,
  }))
}

function getFinancialHabits(transactions: Transaction[]) {
  const expenseTxs = transactions.filter((tx) => tx.amount < 0)
  const totalExpenses = expenseTxs.reduce((s, tx) => s + Math.abs(tx.amount), 0)

  // Avg daily spending (last 30 days)
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentExpenses = expenseTxs.filter((tx) => getDateFromTx(tx) >= thirtyDaysAgo)
  const recentTotal = recentExpenses.reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const avgDaily = recentExpenses.length > 0 ? Math.round(recentTotal / 30) : 0

  // Highest spending day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const daySums = new Array(7).fill(0)
  expenseTxs.forEach((tx) => {
    const d = getDateFromTx(tx)
    daySums[d.getDay()] += Math.abs(tx.amount)
  })
  const highestDayIdx = daySums.indexOf(Math.max(...daySums))
  const highestDay = daySums[highestDayIdx] > 0 ? dayNames[highestDayIdx] : '-'

  // Top category
  const catMap = new Map<string, number>()
  expenseTxs.forEach((tx) => {
    const cat = tx.category || 'Others'
    catMap.set(cat, (catMap.get(cat) || 0) + Math.abs(tx.amount))
  })
  let topCategory = '-'
  let topCategoryPct = 0
  if (catMap.size > 0) {
    const sorted = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1])
    topCategory = sorted[0][0]
    topCategoryPct = totalExpenses > 0 ? Math.round((sorted[0][1] / totalExpenses) * 100) : 0
  }

  // Transaction count
  const txCount = transactions.length

  return { avgDaily, highestDay, topCategory, topCategoryPct, txCount }
}

export default function AnalyticsPage() {
  const { transactions, loading } = useTransactions()
  const [timeRange, setTimeRange] = React.useState('6months')

  // Filter transactions by time range
  const filtered = React.useMemo(
    () => filterByTimeRange(transactions, timeRange),
    [transactions, timeRange]
  )

  // Aggregated data
  const monthlyOverview = React.useMemo(() => buildMonthlyOverview(filtered), [filtered])
  const categoryBreakdown = React.useMemo(() => buildCategoryBreakdown(filtered), [filtered])
  const dailySpending = React.useMemo(() => buildDailySpending(transactions), [transactions])
  const weekdayPattern = React.useMemo(() => buildWeekdayPattern(filtered), [filtered])
  const habits = React.useMemo(() => getFinancialHabits(filtered), [filtered])

  // Summary totals
  const totalIncome = monthlyOverview.reduce((sum, m) => sum + m.income, 0)
  const totalExpenses = monthlyOverview.reduce((sum, m) => sum + m.expenses, 0)
  const totalSavings = totalIncome - totalExpenses
  const avgSavingsRate = totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0

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

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground">
            Detailed financial insights and spending analysis.
          </p>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BarChart3 className="size-12 text-muted-foreground/50" />
            <p className="mt-4 text-lg font-medium">No transaction data yet</p>
            <p className="text-sm text-muted-foreground">
              Add some transactions to see your analytics
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
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="mr-2 size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1month">Last Month</SelectItem>
              <SelectItem value="3months">3 Months</SelectItem>
              <SelectItem value="6months">6 Months</SelectItem>
              <SelectItem value="1year">1 Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Download className="size-4" />
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowUpRight className="size-4 text-primary" />
              Total Income
            </div>
            <p className="mt-2 text-2xl font-bold">฿{totalIncome.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {monthlyOverview.length} months of data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="size-4 text-destructive" />
              Total Expenses
            </div>
            <p className="mt-2 text-2xl font-bold">฿{totalExpenses.toLocaleString()}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {habits.txCount} transactions total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="size-4 text-primary" />
              Net Savings
            </div>
            <p className={cn('mt-2 text-2xl font-bold', totalSavings >= 0 ? 'text-primary' : 'text-destructive')}>
              {totalSavings >= 0 ? '+' : ''}฿{totalSavings.toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Income minus expenses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="size-4" />
              Savings Rate
            </div>
            <p className="mt-2 text-2xl font-bold">{avgSavingsRate}%</p>
            <Progress value={Math.max(0, avgSavingsRate)} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Overview</CardTitle>
            <CardDescription>Income and expenses over time</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>Expense breakdown</CardDescription>
          </CardHeader>
          <CardContent>
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
                {/* Legend */}
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
          </CardContent>
        </Card>
      </div>

      {/* Category Details and Patterns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Top Spenders */}
        <Card>
          <CardHeader>
            <CardTitle>Category Ranking</CardTitle>
            <CardDescription>Your highest spending categories</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                        <Badge
                          variant="secondary"
                          className="text-xs"
                        >
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
          </CardContent>
        </Card>

        {/* Weekday Spending Pattern */}
        <Card>
          <CardHeader>
            <CardTitle>Weekday Spending Pattern</CardTitle>
            <CardDescription>This week vs your average</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Bar dataKey="thisWeek" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="average" fill="var(--chart-4)" radius={[4, 4, 0, 0]} opacity={0.5} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Daily Spending Trend */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Spending Trend</CardTitle>
          <CardDescription>Your spending pattern this month</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Financial Habits Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Financial Habits Summary</CardTitle>
          <CardDescription>Key insights from your spending patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Avg. Daily Spending</p>
              <p className="mt-1 text-2xl font-bold">฿{habits.avgDaily.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Based on last 30 days</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Highest Spending Day</p>
              <p className="mt-1 text-2xl font-bold">{habits.highestDay}</p>
              <p className="text-xs text-muted-foreground mt-1">Day with most spending</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Top Category</p>
              <p className="mt-1 text-2xl font-bold truncate">{habits.topCategory}</p>
              <p className="text-xs text-muted-foreground mt-1">{habits.topCategoryPct}% of total expenses</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Total Transactions</p>
              <p className="mt-1 text-2xl font-bold">{habits.txCount}</p>
              <p className="text-xs text-muted-foreground mt-1">In selected period</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
