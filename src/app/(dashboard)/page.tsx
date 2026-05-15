'use client'

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
  ResponsiveContainer,
} from 'recharts'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { cn } from '@/lib/utils'

// Mock data for charts
const monthlyData = [
  { month: 'Jan', income: 45000, expenses: 32000 },
  { month: 'Feb', income: 48000, expenses: 35000 },
  { month: 'Mar', income: 52000, expenses: 38000 },
  { month: 'Apr', income: 47000, expenses: 41000 },
  { month: 'May', income: 51000, expenses: 36000 },
  { month: 'Jun', income: 55000, expenses: 42000 },
]

const spendingTrend = [
  { day: 'Mon', amount: 1200 },
  { day: 'Tue', amount: 850 },
  { day: 'Wed', amount: 1500 },
  { day: 'Thu', amount: 920 },
  { day: 'Fri', amount: 2100 },
  { day: 'Sat', amount: 1800 },
  { day: 'Sun', amount: 750 },
]

const categoryData = [
  { name: 'Food & Dining', value: 12500, color: 'var(--chart-1)' },
  { name: 'Transport', value: 4200, color: 'var(--chart-2)' },
  { name: 'Shopping', value: 8300, color: 'var(--chart-3)' },
  { name: 'Bills', value: 6500, color: 'var(--chart-4)' },
  { name: 'Entertainment', value: 3200, color: 'var(--chart-5)' },
]

const recentTransactions = [
  { id: 1, description: 'Grab Food - Pad Thai', amount: -185, category: 'Food', date: 'Today', icon: '🍜' },
  { id: 2, description: 'BTS Monthly Pass', amount: -1500, category: 'Transport', date: 'Today', icon: '🚇' },
  { id: 3, description: 'Salary Deposit', amount: 55000, category: 'Income', date: 'Yesterday', icon: '💰' },
  { id: 4, description: 'Central Department Store', amount: -2340, category: 'Shopping', date: 'Yesterday', icon: '🛍️' },
  { id: 5, description: 'Netflix Subscription', amount: -419, category: 'Entertainment', date: '2 days ago', icon: '🎬' },
]

const chartConfig = {
  income: {
    label: 'Income',
    color: 'var(--chart-1)',
  },
  expenses: {
    label: 'Expenses',
    color: 'var(--chart-3)',
  },
  amount: {
    label: 'Amount',
    color: 'var(--chart-1)',
  },
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

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back! Here&apos;s your financial overview for June 2024.
        </p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Balance"
          value="฿127,450"
          change="+12.5%"
          changeType="positive"
          icon={Wallet}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Income"
          value="฿55,000"
          change="+8.2%"
          changeType="positive"
          icon={ArrowUpRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Monthly Expenses"
          value="฿42,000"
          change="+15.3%"
          changeType="negative"
          icon={ArrowDownRight}
          subtitle="vs last month"
        />
        <StatCard
          title="Savings Rate"
          value="23.6%"
          change="-3.1%"
          changeType="negative"
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
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="size-4" />
            </Button>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Spending by Category */}
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
                  <span className="font-medium">฿{category.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Spending Trend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Weekly Spending Trend</CardTitle>
              <CardDescription>Daily spending pattern this week</CardDescription>
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <TrendingDown className="mr-1 size-3" />
              -8% vs last week
            </Badge>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Debt Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Debt Summary</CardTitle>
              <CardDescription>Shared expenses overview</CardDescription>
            </div>
            <Button variant="ghost" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-destructive" />
                  <span className="text-sm font-medium">You Owe</span>
                </div>
                <span className="text-lg font-bold text-destructive">฿3,250</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">2 people</p>
            </div>
            <div className="rounded-lg bg-primary/10 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="size-4 text-primary" />
                  <span className="text-sm font-medium">Owed to You</span>
                </div>
                <span className="text-lg font-bold text-primary">฿5,800</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">3 people</p>
            </div>
            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Net Balance</span>
              <span className="text-lg font-bold text-primary">+฿2,550</span>
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
            <Button variant="outline" size="sm">
              View All
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentTransactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-lg">
                      {transaction.icon}
                    </div>
                    <div>
                      <p className="font-medium">{transaction.description}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {transaction.category}
                        </Badge>
                        <span>{transaction.date}</span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'font-semibold tabular-nums',
                      transaction.amount > 0 ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {transaction.amount > 0 ? '+' : ''}฿
                    {Math.abs(transaction.amount).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* AI Insights Panel */}
        <Card className="border-primary/20 bg-gradient-to-br from-card to-primary/5">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/20 p-2">
                <Sparkles className="size-4 text-primary" />
              </div>
              <CardTitle>AI Insights</CardTitle>
            </div>
            <CardDescription>Smart observations from your data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-background/50 p-3">
              <p className="text-sm">
                <span className="font-medium text-warning">Spending Alert:</span> You spent 35% more on
                food this month compared to your average.
              </p>
            </div>
            <div className="rounded-lg bg-background/50 p-3">
              <p className="text-sm">
                <span className="font-medium text-primary">Pattern Detected:</span> Your weekend
                spending is typically 2x higher than weekdays.
              </p>
            </div>
            <div className="rounded-lg bg-background/50 p-3">
              <p className="text-sm">
                <span className="font-medium text-primary">Savings Tip:</span> Consider reducing
                entertainment expenses by ฿1,500 to hit your savings goal.
              </p>
            </div>
            <Button variant="outline" className="w-full">
              View All Insights
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Expense */}
      <Card className="border-dashed">
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <p className="mb-2 text-muted-foreground">Quick Add Expense</p>
            <Button className="gap-2">
              <Plus className="size-4" />
              Add Transaction
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Or type naturally: &quot;Coffee 45 lunch 120&quot;
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
