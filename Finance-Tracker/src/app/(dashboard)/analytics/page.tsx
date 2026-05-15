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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

// Mock data
const monthlyOverview = [
  { month: 'Jan', income: 52000, expenses: 38000, savings: 14000 },
  { month: 'Feb', income: 55000, expenses: 41000, savings: 14000 },
  { month: 'Mar', income: 48000, expenses: 35000, savings: 13000 },
  { month: 'Apr', income: 60000, expenses: 45000, savings: 15000 },
  { month: 'May', income: 55000, expenses: 42000, savings: 13000 },
  { month: 'Jun', income: 58000, expenses: 44000, savings: 14000 },
]

const categoryBreakdown = [
  { name: 'Food & Dining', value: 12500, percentage: 28, budget: 15000 },
  { name: 'Transport', value: 4200, percentage: 9, budget: 5000 },
  { name: 'Shopping', value: 8300, percentage: 19, budget: 8000 },
  { name: 'Bills & Utilities', value: 6500, percentage: 15, budget: 7000 },
  { name: 'Entertainment', value: 3200, percentage: 7, budget: 5000 },
  { name: 'Health & Fitness', value: 2800, percentage: 6, budget: 3000 },
  { name: 'Others', value: 6500, percentage: 15, budget: 7000 },
]

const dailySpending = [
  { day: '1', amount: 1200 },
  { day: '2', amount: 850 },
  { day: '3', amount: 1500 },
  { day: '4', amount: 920 },
  { day: '5', amount: 2100 },
  { day: '6', amount: 1800 },
  { day: '7', amount: 750 },
  { day: '8', amount: 1100 },
  { day: '9', amount: 1400 },
  { day: '10', amount: 900 },
  { day: '11', amount: 1600 },
  { day: '12', amount: 1300 },
  { day: '13', amount: 2200 },
  { day: '14', amount: 1900 },
  { day: '15', amount: 800 },
]

const weekdayPattern = [
  { day: 'Mon', thisWeek: 1200, average: 1100 },
  { day: 'Tue', thisWeek: 850, average: 900 },
  { day: 'Wed', thisWeek: 1500, average: 1200 },
  { day: 'Thu', thisWeek: 920, average: 1000 },
  { day: 'Fri', thisWeek: 2100, average: 1800 },
  { day: 'Sat', thisWeek: 1800, average: 2200 },
  { day: 'Sun', thisWeek: 750, average: 1400 },
]

const savingsGoals = [
  { name: 'Emergency Fund', current: 85000, target: 150000, color: 'var(--chart-1)' },
  { name: 'Vacation', current: 25000, target: 50000, color: 'var(--chart-2)' },
  { name: 'New Laptop', current: 18000, target: 45000, color: 'var(--chart-4)' },
]

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

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState('6months')

  const totalIncome = monthlyOverview.reduce((sum, m) => sum + m.income, 0)
  const totalExpenses = monthlyOverview.reduce((sum, m) => sum + m.expenses, 0)
  const totalSavings = monthlyOverview.reduce((sum, m) => sum + m.savings, 0)
  const avgSavingsRate = Math.round((totalSavings / totalIncome) * 100)

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
            <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary">
              <TrendingUp className="mr-1 size-3" />
              +8.2% vs previous
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowDownRight className="size-4 text-destructive" />
              Total Expenses
            </div>
            <p className="mt-2 text-2xl font-bold">฿{totalExpenses.toLocaleString()}</p>
            <Badge variant="secondary" className="mt-2 bg-destructive/10 text-destructive">
              <TrendingUp className="mr-1 size-3" />
              +12.5% vs previous
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <PiggyBank className="size-4 text-primary" />
              Total Savings
            </div>
            <p className="mt-2 text-2xl font-bold">฿{totalSavings.toLocaleString()}</p>
            <Badge variant="secondary" className="mt-2 bg-primary/10 text-primary">
              <TrendingDown className="mr-1 size-3" />
              -3.1% vs previous
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Target className="size-4" />
              Savings Rate
            </div>
            <p className="mt-2 text-2xl font-bold">{avgSavingsRate}%</p>
            <Progress value={avgSavingsRate} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Cash Flow Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cash Flow Overview</CardTitle>
            <CardDescription>Income, expenses, and savings over time</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>This month&apos;s breakdown</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      </div>

      {/* Category Details and Patterns */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Category Budget Progress */}
        <Card>
          <CardHeader>
            <CardTitle>Budget vs Actual</CardTitle>
            <CardDescription>Category spending against budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {categoryBreakdown.slice(0, 5).map((category, index) => {
              const percentage = Math.round((category.value / category.budget) * 100)
              const isOverBudget = percentage > 100
              return (
                <div key={category.name}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-3 rounded-full"
                        style={{ backgroundColor: categoryColors[index] }}
                      />
                      <span>{category.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        ฿{category.value.toLocaleString()} / ฿{category.budget.toLocaleString()}
                      </span>
                      <Badge
                        variant="secondary"
                        className={cn(
                          'text-xs',
                          isOverBudget
                            ? 'bg-destructive/10 text-destructive'
                            : 'bg-primary/10 text-primary'
                        )}
                      >
                        {percentage}%
                      </Badge>
                    </div>
                  </div>
                  <Progress
                    value={Math.min(percentage, 100)}
                    className={cn('h-2', isOverBudget && '[&>div]:bg-destructive')}
                  />
                </div>
              )
            })}
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

      {/* Daily Spending and Savings Goals */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Daily Spending Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily Spending Trend</CardTitle>
            <CardDescription>Your spending pattern this month</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Savings Goals */}
        <Card>
          <CardHeader>
            <CardTitle>Savings Goals</CardTitle>
            <CardDescription>Track your progress</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {savingsGoals.map((goal) => {
              const percentage = Math.round((goal.current / goal.target) * 100)
              return (
                <div key={goal.name}>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="font-medium">{goal.name}</span>
                    <span className="text-muted-foreground">{percentage}%</span>
                  </div>
                  <Progress
                    value={percentage}
                    className="h-3"
                    style={{ '--progress-color': goal.color } as React.CSSProperties}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                    <span>฿{goal.current.toLocaleString()}</span>
                    <span>฿{goal.target.toLocaleString()}</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

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
              <p className="mt-1 text-2xl font-bold">฿1,467</p>
              <p className="text-xs text-muted-foreground mt-1">Based on last 30 days</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Highest Spending Day</p>
              <p className="mt-1 text-2xl font-bold">Friday</p>
              <p className="text-xs text-muted-foreground mt-1">Avg. ฿2,100 per Friday</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Top Category</p>
              <p className="mt-1 text-2xl font-bold">Food & Dining</p>
              <p className="text-xs text-muted-foreground mt-1">28% of total expenses</p>
            </div>
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Budget Adherence</p>
              <p className="mt-1 text-2xl font-bold">85%</p>
              <p className="text-xs text-muted-foreground mt-1">Within budget categories</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
