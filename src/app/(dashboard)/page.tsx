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
import { useContext } from 'react'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { TransactionsContext } from '@/providers/transactions-context'
import { useDebts } from '@/hooks/use-debts'
import { useTripsData } from '@/hooks/use-trips-data-context'
import { useTrips } from '@/hooks/use-trips'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions'
import { useAllTripExpenses } from '@/hooks/use-all-trip-expenses'
import { useUserSettings } from '@/hooks/use-user-settings'
import { TransactionForm } from '@/components/transactions/transaction-form'
import { TransactionDetailDialog } from '@/components/transactions/transaction-detail-dialog'
import { TripExpenseDialog } from '@/components/trips/trip-expense-dialog'
import { RecurringDueCard } from '@/components/dashboard/recurring-due-card'
import {
  MonthAnimatedValue,
  MonthContentTransition,
  useMonthTransition,
} from '@/components/shared/month-transition'
import { MonthPicker } from '@/components/shared/month-picker'
import {
  formatMonthLabel,
  getCurrentMonthSelection,
  getLatestAvailableMonth,
  getPreviousMonthSelection,
  hasMonthData,
  isCurrentMonthSelection,
} from '@/lib/datetime'
import {
  mergeTransactions,
  filterByMonth,
  buildMonthlyOverview,
  buildCategoryBreakdown,
  buildWeekdaySpending,
  getWeekSpendingComparison,
  getFinancialHabits,
  computeMonthTotals,
  computePercentChange,
  buildDashboardInsights,
  collectMonthsWithData,
  formatMoney,
  getDateFromTx,
  getCategoryIcon,
  getCountedExpenseThb,
} from '@/lib/aggregate-transactions'
import { shouldIgnoreRowClick } from '@/lib/row-click'
import { Transaction, TripExpense } from '@/lib/firestore-types'

const chartConfig = {
  income: { label: 'Income', color: 'var(--chart-1)' },
  expenses: { label: 'Expenses', color: 'var(--chart-3)' },
  amount: { label: 'Amount', color: 'var(--chart-1)' },
}

const MONTHLY_BAR_WIDTH = 72
const SCROLL_EDGE_THRESHOLD = 48
const LOAD_OLDER_THROTTLE_MS = 600

type MonthlyChartPoint = {
  month: string
  income: number
  expenses: number
  savings: number
}

function IncomeExpensesScrollChart({
  data,
  hasOlderData,
  loadingOlder,
  onLoadOlder,
}: {
  data: MonthlyChartPoint[]
  hasOlderData: boolean
  loadingOlder: boolean
  onLoadOlder: () => void
}) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const scrollWidthBeforeLoadRef = React.useRef(0)
  const hasScrolledToEndRef = React.useRef(false)
  const lastLoadAttemptRef = React.useRef(0)
  const prevDataLengthRef = React.useRef(data.length)
  const touchStartXRef = React.useRef(0)

  const chartMinWidth = Math.max(data.length * MONTHLY_BAR_WIDTH, 320)

  const tryLoadOlder = React.useCallback(() => {
    if (!hasOlderData || loadingOlder) return
    const now = Date.now()
    if (now - lastLoadAttemptRef.current < LOAD_OLDER_THROTTLE_MS) return
    lastLoadAttemptRef.current = now
    scrollWidthBeforeLoadRef.current = scrollRef.current?.scrollWidth ?? 0
    onLoadOlder()
  }, [hasOlderData, loadingOlder, onLoadOlder])

  const checkLeftEdge = React.useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
      tryLoadOlder()
    }
  }, [tryLoadOlder])

  React.useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (!hasScrolledToEndRef.current && data.length > 0) {
      el.scrollLeft = el.scrollWidth - el.clientWidth
      hasScrolledToEndRef.current = true
      prevDataLengthRef.current = data.length
      return
    }

    if (data.length > prevDataLengthRef.current && scrollWidthBeforeLoadRef.current > 0) {
      const widthAdded = el.scrollWidth - scrollWidthBeforeLoadRef.current
      if (widthAdded > 0) {
        el.scrollLeft += widthAdded
      }
      scrollWidthBeforeLoadRef.current = 0
    }

    prevDataLengthRef.current = data.length
  }, [data.length])

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? 0
  }, [])

  const handleTouchEnd = React.useCallback(
    (e: React.TouchEvent) => {
      const el = scrollRef.current
      const touch = e.changedTouches[0]
      if (!el || !touch) return

      const deltaX = touch.clientX - touchStartXRef.current
      if (deltaX > 40 && el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
        tryLoadOlder()
      }
    },
    [tryLoadOlder]
  )

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      const canScrollHorizontally = el.scrollWidth > el.clientWidth + 1

      if (canScrollHorizontally) {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
        e.preventDefault()
        el.scrollLeft += e.deltaY
        checkLeftEdge()
        return
      }

      if (e.deltaY < 0 && el.scrollLeft <= SCROLL_EDGE_THRESHOLD) {
        tryLoadOlder()
      }
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [checkLeftEdge, tryLoadOlder])

  return (
    <div className="relative min-w-0">
      <div
        ref={scrollRef}
        className="min-w-0 max-w-full overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:thin]"
        onScroll={checkLeftEdge}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[280px] w-full max-w-full min-w-0"
          style={{ minWidth: chartMinWidth }}
        >
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
      </div>
      {(loadingOlder || hasOlderData) && (
        <div
          className={cn(
            'pointer-events-none absolute left-0 top-0 flex h-8 max-w-[min(100%,14rem)] items-center gap-1.5 rounded-r-md bg-background/80 px-2 text-xs text-muted-foreground backdrop-blur-sm',
            !loadingOlder && 'opacity-60'
          )}
          aria-hidden={!loadingOlder}
        >
          {loadingOlder ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>กำลังโหลด...</span>
            </>
          ) : (
            <span>เลื่อนซ้ายเพื่อดูข้อมูลเก่ากว่า</span>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  title,
  value,
  valueKey,
  change,
  changeType,
  icon: Icon,
  subtitle,
}: {
  title: string
  value: string
  valueKey: string
  change: string
  changeType: 'positive' | 'negative' | 'neutral'
  icon: React.ElementType
  subtitle?: string
}) {
  return (
    <Card className="relative min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="shrink-0 rounded-lg bg-muted p-2">
          <Icon className="size-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <MonthAnimatedValue
          valueKey={valueKey}
          className="truncate text-xl font-bold sm:text-2xl"
        >
          {value}
        </MonthAnimatedValue>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <MonthAnimatedValue valueKey={`${valueKey}-change`} className="inline-flex">
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
          </MonthAnimatedValue>
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
  const {
    transactions,
    tripExpenses: allTripExpenses,
    loading: dashboardDataLoading,
    loadOlderChartData,
    hasOlderChartData,
    chartLoadingOlder,
  } = useDashboardData(user?.uid)
  const { transactions: allTransactions } = useTransactions()
  const { allTripExpenses: fullTripExpenses } = useAllTripExpenses()
  const { addTransaction, editTransaction } = useContext(TransactionsContext)!
  const { debts, loading: debtLoading } = useDebts()
  const { tripDebts, loading: tripDebtLoading } = useTripsData()
  const { trips, loading: tripsLoading } = useTrips()

  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false)
  const [isDetailOpen, setIsDetailOpen] = React.useState(false)
  const [detailTransaction, setDetailTransaction] = React.useState<Transaction | null>(null)
  const [detailTripExpense, setDetailTripExpense] = React.useState<TripExpense | null>(null)
  const [viewingTripExpense, setViewingTripExpense] = React.useState<TripExpense | null>(null)
  const [isTripExpenseOpen, setIsTripExpenseOpen] = React.useState(false)

  const [selectedMonth, setSelectedMonth] = React.useState(getCurrentMonthSelection)
  const { monthKey, direction: monthDirection, onMonthChange } = useMonthTransition(selectedMonth)

  const handleSelectedMonthChange = React.useCallback(
    (next: typeof selectedMonth) => onMonthChange(next, setSelectedMonth),
    [onMonthChange]
  )

  const tripForViewingExpense = React.useMemo(
    () =>
      viewingTripExpense
        ? trips.find((trip) => trip.id === viewingTripExpense.tripId) ?? null
        : null,
    [trips, viewingTripExpense]
  )

  const loading =
    dashboardDataLoading || debtLoading || tripDebtLoading || tripsLoading
  const currency = profile?.currency || 'THB'

  const allCombined = React.useMemo(
    () => mergeTransactions(transactions, allTripExpenses, user?.uid),
    [transactions, allTripExpenses, user?.uid]
  )

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

  const selectedMonthTxs = React.useMemo(
    () => filterByMonth(allCombined, selectedMonth.year, selectedMonth.month),
    [allCombined, selectedMonth]
  )
  const previousMonthSelection = React.useMemo(
    () => getPreviousMonthSelection(selectedMonth),
    [selectedMonth]
  )
  const previousMonthTxs = React.useMemo(
    () => filterByMonth(allCombined, previousMonthSelection.year, previousMonthSelection.month),
    [allCombined, previousMonthSelection]
  )

  const monthlyData = React.useMemo(() => buildMonthlyOverview(allCombined), [allCombined])
  const categoryData = React.useMemo(() => buildCategoryBreakdown(selectedMonthTxs), [selectedMonthTxs])
  const spendingTrend = React.useMemo(
    () => (isCurrentMonthSelection(selectedMonth) ? buildWeekdaySpending(allCombined) : buildWeekdaySpending(selectedMonthTxs)),
    [allCombined, selectedMonth, selectedMonthTxs]
  )
  const weekComparison = React.useMemo(() => {
    if (isCurrentMonthSelection(selectedMonth)) {
      return getWeekSpendingComparison(allCombined)
    }
    const thisMonthExpenses = selectedMonthTxs.reduce((s, tx) => s + getCountedExpenseThb(tx), 0)
    const prevMonthExpenses = previousMonthTxs.reduce((s, tx) => s + getCountedExpenseThb(tx), 0)
    return computePercentChange(thisMonthExpenses, prevMonthExpenses)
  }, [allCombined, selectedMonth, selectedMonthTxs, previousMonthTxs])
  const habits = React.useMemo(() => getFinancialHabits(selectedMonthTxs), [selectedMonthTxs])
  const insights = React.useMemo(
    () => buildDashboardInsights(selectedMonthTxs, habits),
    [selectedMonthTxs, habits]
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

  const recentTransactions = React.useMemo(() => allCombined.slice(0, 5), [allCombined])

  const handleViewTransaction = (transaction: (typeof allCombined)[number]) => {
    if (transaction.isLegacy && transaction.rawTx) {
      setDetailTransaction(transaction.rawTx)
      setDetailTripExpense(null)
      setIsDetailOpen(true)
      return
    }
    if (transaction.rawEx) {
      const trip = trips.find((t) => t.id === transaction.rawEx!.tripId)
      if (trip) {
        setViewingTripExpense(transaction.rawEx)
        setIsTripExpenseOpen(true)
        return
      }
      setDetailTransaction(null)
      setDetailTripExpense(transaction.rawEx)
      setIsDetailOpen(true)
    }
  }

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

  const selectedMonthLabel = formatMonthLabel(selectedMonth)

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
    <div className="flex min-w-0 max-w-full flex-col gap-4 overflow-x-hidden p-4 sm:gap-6 sm:p-6">
      {/* Page Header */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Welcome back! Here&apos;s your financial overview for{' '}
            <MonthAnimatedValue
              valueKey={monthKey}
              className="font-medium text-foreground"
            >
              {selectedMonthLabel}
            </MonthAnimatedValue>
            .
            {activeTrips.length > 0 && (
              <span className="ml-2 inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {activeTrips.length} active trip{activeTrips.length > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <MonthPicker
          value={selectedMonth}
          onChange={handleSelectedMonthChange}
          className="shrink-0 self-start"
          monthsWithData={monthsWithData}
        />
      </div>

      <RecurringDueCard />

      {/* Quick Stats Grid */}
      <MonthContentTransition
        monthKey={monthKey}
        direction={monthDirection}
        className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Net Cash Flow"
          valueKey={`${monthKey}-net`}
          value={formatMoney(currentTotals.net, currency, true)}
          change={netChange.value}
          changeType={netChange.type}
          icon={Wallet}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Income"
          valueKey={`${monthKey}-income`}
          value={formatMoney(currentTotals.income, currency)}
          change={incomeChange.value}
          changeType={incomeChange.type}
          icon={ArrowUpRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Expenses"
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
          icon={ArrowDownRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Savings Rate"
          valueKey={`${monthKey}-savings`}
          value={`${currentTotals.savingsRate}%`}
          change={savingsChange.value}
          changeType={savingsChange.type}
          icon={TrendingUp}
          subtitle="vs last month"
        />
      </MonthContentTransition>

      {/* Main Content Grid */}
      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Income vs Expenses Chart */}
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 px-4 sm:px-6">
            <div className="min-w-0">
              <CardTitle>Income vs Expenses</CardTitle>
              <CardDescription>Monthly comparison from loaded history</CardDescription>
            </div>
            <Button variant="ghost" size="icon" className="shrink-0" asChild>
              <Link href="/analytics">
                <MoreHorizontal className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 px-4 sm:px-6">
            {monthlyData.length > 0 ? (
              <IncomeExpensesScrollChart
                data={monthlyData}
                hasOlderData={hasOlderChartData}
                loadingOlder={chartLoadingOlder}
                onLoadOlder={loadOlderChartData}
              />
            ) : (
              <div className="flex h-[280px] items-center justify-center text-muted-foreground">
                No transaction data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Spending by Category */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>
              <MonthAnimatedValue valueKey={`${monthKey}-category-desc`} className="inline">
                {isCurrentMonthSelection(selectedMonth)
                  ? "This month's breakdown"
                  : `${selectedMonthLabel} breakdown`}
              </MonthAnimatedValue>
            </CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 px-4 sm:px-6">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
              {categoryData.length > 0 ? (
                <>
                  <ChartContainer config={chartConfig} className="mx-auto aspect-auto h-[180px] w-full max-w-full min-w-0">
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
                      <div key={category.name} className="flex min-w-0 items-center justify-between gap-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          <span className="truncate text-muted-foreground">{category.name}</span>
                        </div>
                        <span className="shrink-0 font-medium tabular-nums">{formatMoney(category.value, currency)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex h-[180px] items-center justify-center text-muted-foreground">
                  No expenses this month
                </div>
              )}
            </MonthContentTransition>
          </CardContent>
        </Card>

        {/* Spending Trend */}
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-col gap-3 px-4 sm:flex-row sm:items-start sm:justify-between sm:px-6">
            <div className="min-w-0">
              <CardTitle>
                <MonthAnimatedValue valueKey={`${monthKey}-trend-title`} className="inline">
                  {isCurrentMonthSelection(selectedMonth) ? 'Weekly Spending Trend' : 'Weekday Spending'}
                </MonthAnimatedValue>
              </CardTitle>
              <CardDescription>
                <MonthAnimatedValue valueKey={`${monthKey}-trend-desc`} className="inline">
                  {isCurrentMonthSelection(selectedMonth)
                    ? 'Daily spending pattern this week'
                    : `Spending by weekday in ${selectedMonthLabel}`}
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
          </CardHeader>
          <CardContent className="min-w-0 px-4 sm:px-6">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
              {spendingTrend.some((d) => d.amount > 0) ? (
                <ChartContainer config={chartConfig} className="aspect-auto h-[200px] w-full max-w-full min-w-0">
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
                  {isCurrentMonthSelection(selectedMonth)
                    ? 'No spending this week yet'
                    : 'No spending this month'}
                </div>
              )}
            </MonthContentTransition>
          </CardContent>
        </Card>

        {/* Debt Summary */}
        <Card className="min-w-0 overflow-hidden">
          <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 sm:px-6">
            <div className="min-w-0">
              <CardTitle>Debt Summary</CardTitle>
              <CardDescription>Shared expenses overview</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="shrink-0" asChild>
              <Link href="/debts">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
            <div className="rounded-lg bg-destructive/10 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Users className="size-4 shrink-0 text-destructive" />
                  <span className="text-sm font-medium">You Owe</span>
                </div>
                <span className="shrink-0 text-base font-bold text-destructive tabular-nums sm:text-lg">
                  {formatMoney(debtSummary.totalOwed, currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {debtSummary.uniqueOwePeople} {debtSummary.uniqueOwePeople === 1 ? 'person' : 'people'}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <CreditCard className="size-4 shrink-0 text-primary" />
                  <span className="text-sm font-medium">Owed to You</span>
                </div>
                <span className="shrink-0 text-base font-bold text-primary tabular-nums sm:text-lg">
                  {formatMoney(debtSummary.totalOwedToYou, currency)}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {debtSummary.uniqueOwedPeople}{' '}
                {debtSummary.uniqueOwedPeople === 1 ? 'person' : 'people'}
              </p>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">Net Balance</span>
              <span
                className={cn(
                  'shrink-0 text-base font-bold tabular-nums sm:text-lg',
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
      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-3">
        {/* Recent Transactions */}
        <Card className="min-w-0 overflow-hidden lg:col-span-2">
          <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 sm:px-6">
            <div className="min-w-0">
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Your latest financial activities</CardDescription>
            </div>
            <Button variant="outline" size="sm" className="shrink-0" asChild>
              <Link href="/transactions">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 px-4 sm:px-6">
            {recentTransactions.length > 0 ? (
              <div className="space-y-4">
                {recentTransactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex cursor-pointer items-center justify-between gap-3 rounded-lg p-2 transition-colors hover:bg-muted/50"
                    onClick={(e) => {
                      if (shouldIgnoreRowClick(e.target)) return
                      handleViewTransaction(transaction)
                    }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                        {getCategoryIcon(transaction.category, transaction.amountThb)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{transaction.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="max-w-full truncate text-[10px]">
                            {transaction.category}
                          </Badge>
                          <span className="shrink-0">{formatRelativeDate(getDateFromTx(transaction))}</span>
                        </div>
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 text-sm font-semibold tabular-nums sm:text-base',
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
        <Card className="min-w-0 overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader className="px-4 sm:px-6">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-2">
                <Sparkles className="size-4 text-primary" />
              </div>
              <CardTitle>Insights</CardTitle>
            </div>
            <CardDescription>Observations from your spending data</CardDescription>
          </CardHeader>
          <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
            <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
              {insights.length > 0 ? (
                insights.map((insight, i) => (
                  <div key={i} className="rounded-lg bg-background/50 p-3">
                    <p className="break-words text-sm">
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
            </MonthContentTransition>
            <Button variant="outline" className="w-full" asChild>
              <Link href="/insights">View All Insights</Link>
            </Button>
          </CardContent>
        </Card>
      </div>



      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[min(90vh,90dvh)] w-[calc(100vw-1rem)] overflow-y-auto overflow-x-hidden p-4 max-sm:top-[4vh] max-sm:translate-y-0 sm:max-w-lg sm:p-6">
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

      <TransactionDetailDialog
        open={isDetailOpen}
        onOpenChange={(open) => {
          setIsDetailOpen(open)
          if (!open) {
            setDetailTransaction(null)
            setDetailTripExpense(null)
          }
        }}
        transaction={detailTransaction}
        tripExpense={detailTripExpense}
        onSaveTransaction={async (id, data) => {
          await editTransaction(id, data)
          setDetailTransaction(null)
          setDetailTripExpense(null)
        }}
      />

      <TripExpenseDialog
        open={isTripExpenseOpen}
        onOpenChange={(open) => {
          setIsTripExpenseOpen(open)
          if (!open) setViewingTripExpense(null)
        }}
        expense={viewingTripExpense}
        trip={tripForViewingExpense}
        myUserId={user?.uid || ''}
      />
    </div>
  )
}
