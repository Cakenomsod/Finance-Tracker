'use client'

import * as React from 'react'
import Link from 'next/link'
import { format } from 'date-fns'
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  CreditCard,
  Users,
  Sparkles,
  MoreHorizontal,
  Plus,
  Loader2,
  MapPin,
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
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useTransactions } from '@/hooks/use-transactions'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useDebts } from '@/hooks/use-debts'
import { useTripDebts } from '@/hooks/use-trip-debts'
import { useTrips } from '@/hooks/use-trips'
import { useAuth } from '@/hooks/use-auth'
import { useUserSettings } from '@/hooks/use-user-settings'
import { TransactionForm } from '@/components/transactions/transaction-form'
import {
  mergeTransactions,
  filterByTimeRange,
  filterCurrentMonth,
  filterPreviousMonth,
  buildMonthlyOverview,
  buildCategoryBreakdown,
  buildWeekdaySpending,
  getWeekSpendingComparison,
  getFinancialHabits,
  computeMonthTotals,
  computePercentChange,
  buildDashboardInsights,
  formatMoney,
  getDateFromTx,
  getCategoryIcon,
} from '@/lib/aggregate-transactions'

const chartConfig = {
  income: { label: 'Income', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-3)' },
  amount: { label: 'Amount', color: 'var(--chart-1)' },
}

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  subtitle,
}: {
  title: string
  value: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="rounded-lg bg-muted p-2">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className="flex items-center gap-2 mt-1">
          <Badge
            variant="secondary"
            className={cn(
              'text-xs font-medium',
              changeType === 'positive' && 'bg-primary/10 text-primary',
              changeType === 'negative' && 'bg-destructive/10 text-destructive'
            )}
          >
            {changeType === 'positive' ? (
              <TrendingUp className="mr-1 size-3" />
            ) : changeType === 'negative' ? (
              <TrendingDown className="mr-1 size-3" />
            ) : null}
            {change}
          </Badge>
          {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  )
}

function formatRelativeDate(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return format(date, 'MMM d')
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { profile } = useUserSettings()
  const { transactions, loading: txLoading, addTransaction } = useTransactions()
  const { allTripExpenses, loading: tripLoading } = useAllTripExpenses()
  const { debts, loading: debtLoading } = useDebts()
  const { tripDebts, loading: tripDebtLoading } = useTripDebts()
  const { trips, loading: tripsLoading } = useTrips()

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)

  const loading = txLoading || tripLoading || debtLoading || tripDebtLoading || tripsLoading
  const currency = profile?.currency || 'THB'

  const allCombined = React.useMemo(
    () => mergeTransactions(transactions, allTripExpenses),
    [transactions, allTripExpenses]
  )

  const last6Months = React.useMemo(
    () => filterByTimeRange(allCombined, '6months'),
    [allCombined]
  )

  const currentMonth = React.useMemo(() => filterCurrentMonth(allCombined), [allCombined])
  const previousMonth = React.useMemo(() => filterPreviousMonth(allCombined), [allCombined])

  const monthlyData = React.useMemo(() => buildMonthlyOverview(last6Months), [last6Months])
  const categoryData = React.useMemo(() => buildCategoryBreakdown(currentMonth), [currentMonth])
  const spendingTrend = React.useMemo(() => buildWeekdaySpending(allCombined), [allCombined])
  const weekComparison = React.useMemo(() => getWeekSpendingComparison(allCombined), [allCombined])
  const habits = React.useMemo(() => getFinancialHabits(last6Months), [last6Months])
  const insights = React.useMemo(
    () => buildDashboardInsights(currentMonth, habits),
    [currentMonth, habits]
  )

  const currentTotals = React.useMemo(() => computeMonthTotals(currentMonth), [currentMonth])
  const previousTotals = React.useMemo(() => computeMonthTotals(previousMonth), [previousMonth])

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

  const recentTransactions = React.useMemo(() => allCombined.slice(0, 5), [allCombined])

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

  const activeTrips = React.useMemo(
    () => trips.filter((t) => t.status === 'active'),
    [trips]
  )

  const currentMonthLabel = format(new Date(), 'MMMM yyyy')

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Loader2 className="mx-auto size-8 animate-spin text-muted-foreground" />
          <p className="mt-2 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your financial overview for {currentMonthLabel}.
          {activeTrips.length > 0 && (
            <span className="ml-2 inline-flex items-center gap-1">
              <MapPin className="size-3" />
              {activeTrips.length} active trip{activeTrips.length > 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Net Cash Flow"
          value={formatMoney(currentTotals.net, currency, true)}
          change={netChange.value}
          changeType={netChange.type}
          icon={Wallet}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Income"
          value={formatMoney(currentTotals.income, currency)}
          change={incomeChange.value}
          changeType={incomeChange.type}
          icon={ArrowUpRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Expenses"
          value={formatMoney(currentTotals.expenses, currency)}
          change={expenseChange.value}
          changeType={
            expenseChange.type === 'positive'
              ? 'negative'
              : expenseChange.type === 'negative'
                ? 'positive'
                : 'neutral'
          }
          icon={ArrowDownRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Savings Rate"
          value={`${currentTotals.savingsRate}%`}
          change={savingsChange.value}
          changeType={savingsChange.type}
          icon={TrendingUp}
          subtitle="vs last month"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Income vs Expenses Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>Monthly comparison over 6 months</CardDescription>
            </div>
            <Button variant="ghost" size="icon" asChild>
              <Link href="/analytics">
                <MoreHorizontal className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {monthlyData.length > 0 ? (
              <ChartContainer config={chartConfig} className="h-[280px] w-full">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
                  <Bar dataKey="income" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                No transaction data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>This month&apos;s breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {categoryData.length > 0 ? (
              <>
                <ChartContainer config={chartConfig} className="mx-auto h-[180px] w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
                <div className="mt-4 space-y-2">
                  {categoryData.slice(0, 3).map((category) => (
                    <div key={category.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-muted-foreground">{category.name}</span>
                      </div>
                      <span className="font-medium">{formatMoney(category.value, currency)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex h-[180px] items-center justify-center text-muted-foreground">
                No expenses this month
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Weekly Spending Trend</CardTitle>
              <CardDescription>Daily spending pattern this week</CardDescription>
            </div>
            {weekComparison.value !== 'New' && weekComparison.value !== '0%' && (
              <Badge
                variant="secondary"
                className={cn(
                  weekComparison.type === 'negative' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                )}
              >
                {weekComparison.type === 'negative' ? (
                  <TrendingDown className="mr-1 size-3" />
                ) : (
                  <TrendingUp className="mr-1 size-3" />
                )}
                {weekComparison.value} vs last week
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {spendingTrend.some((d) => d.amount > 0) ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <LineChart data={spendingTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
              <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                No spending this week yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Debt Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Debt Summary</CardTitle>
              <CardDescription>Shared expenses overview</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/debts">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-destructive" />
                  <span className="text-sm font-medium">You Owe</span>
                </div>
                <span className="text-lg font-bold text-destructive">
                  {formatMoney(debtSummary.totalOwed, currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {debtSummary.uniqueOwePeople} {debtSummary.uniqueOwePeople === 1 ? 'person' : 'people'}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  <span className="text-sm font-medium">Owed to You</span>
                </div>
                <span className="text-lg font-bold text-primary">
                  {formatMoney(debtSummary.totalOwedToYou, currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {debtSummary.uniqueOwedPeople}{' '}
                {debtSummary.uniqueOwedPeople === 1 ? 'person' : 'people'}
              </p>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Net Balance</span>
              <span
                className={cn(
                  'text-lg font-bold',
                  debtSummary.netBalance >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatMoney(debtSummary.netBalance, currency, true)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activities</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link href="/transactions">View All</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recentTransactions.length > 0 ? (
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-lg">
                        {getCategoryIcon(transaction.category, transaction.amountThb)}
                      </div>
                      <div>
                        <p className="font-medium">{transaction.description}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px]">
                            {transaction.category}
                          </Badge>
                          <span>{formatRelativeDate(getDateFromTx(transaction))}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'font-semibold tabular-nums',
                        transaction.amountThb > 0 ? 'text-primary' : 'text-foreground'
                      )}
                    >
                      {formatMoney(transaction.amountThb, currency, true)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No transactions yet. Add your first one below.
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Insights Panel */}
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-2">
                <Sparkles className="size-4 text-primary" />
              </div>
              <CardTitle>Insights</CardTitle>
            </div>
            <CardDescription>Observations from your spending data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {insights.length > 0 ? (
              insights.map((insight, i) => (
                <div key={i} className="rounded-lg bg-background/50 p-3">
                  <p className="text-sm">
                    <span
                      className={cn(
                        'font-medium',
                        insight.type === 'alert' && 'text-warning',
                        insight.type === 'pattern' && 'text-primary',
                        insight.type === 'tip' && 'text-primary'
                      )}
                    >
                      {insight.type === 'alert'
                        ? 'Spending Alert:'
                        : insight.type === 'pattern'
                          ? 'Pattern Detected:'
                          : 'Savings Tip:'}
                    </span>{' '}
                    {insight.text}
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-background/50 p-3">
                <p className="text-sm text-muted-foreground">
                  Add transactions to see personalized insights.
                </p>
              </div>
            )}
            <Button variant="outline" className="w-full" asChild>
              <Link href="/insights">View All Insights</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Expense */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="mb-2 text-muted-foreground">Quick Add Expense</p>
            <Button className="gap-2" onClick={() => setIsAddDialogOpen(true)}>
              <Plus className="size-4" />
              Add Transaction
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Or go to{' '}
              <Link href="/transactions" className="text-primary hover:underline">
                Transactions
              </Link>{' '}
              for AI-powered quick add
            </p>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
            <DialogDescription>Record a new income or expense.</DialogDescription>
          </DialogHeader>
          <TransactionForm
            onSubmit={async (data) => {
              await addTransaction(data)
              setIsAddDialogOpen(false)
            }}
            onCancel={() => setIsAddDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
