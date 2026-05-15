'use client'

import * as React from 'react'
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Target,
  Calendar,
  RefreshCw,
  ChevronRight,
  Zap,
  PiggyBank,
  ShoppingBag,
  Coffee,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// Mock AI insights data
const monthlyInsights = {
  summary: `Based on your spending data this month, you've spent ฿44,000 across 156 transactions. Your food and dining expenses increased by 35% compared to last month, mainly due to more frequent food delivery orders. Your savings rate dropped to 20%, which is below your 25% target.`,
  highlights: [
    {
      type: 'warning',
      title: 'Food Spending Alert',
      description: 'You spent 35% more on food this month compared to your average.',
      impact: 'high',
      amount: 12500,
      change: '+35%',
    },
    {
      type: 'insight',
      title: 'Weekend Spending Pattern',
      description: 'Your weekend spending is typically 2x higher than weekdays.',
      impact: 'medium',
    },
    {
      type: 'positive',
      title: 'Transport Savings',
      description: 'You saved ฿800 on transport by using BTS more frequently.',
      impact: 'low',
      amount: 800,
    },
    {
      type: 'warning',
      title: 'Subscription Creep',
      description: 'Your subscription costs increased by 3 new services this month.',
      impact: 'medium',
      amount: 897,
    },
  ],
}

const budgetingTips = [
  {
    icon: Coffee,
    title: 'Reduce coffee spending',
    description: 'You spend ฿2,400/month on coffee. Making coffee at home could save ฿1,800.',
    potential: 1800,
    difficulty: 'Easy',
  },
  {
    icon: ShoppingBag,
    title: 'Set shopping limits',
    description: 'Implement a weekly shopping budget of ฿2,000 to stay within your target.',
    potential: 2300,
    difficulty: 'Medium',
  },
  {
    icon: Target,
    title: 'Automate savings',
    description: 'Set up automatic transfer of 25% income to savings on payday.',
    potential: 3000,
    difficulty: 'Easy',
  },
]

const unusualSpending = [
  {
    description: 'Large purchase at Apple Store',
    amount: 15900,
    date: '2024-06-10',
    category: 'Shopping',
    status: 'flagged',
  },
  {
    description: 'Multiple food deliveries in one day',
    amount: 850,
    date: '2024-06-08',
    category: 'Food & Dining',
    status: 'flagged',
  },
  {
    description: 'Recurring charge from unknown service',
    amount: 299,
    date: '2024-06-05',
    category: 'Subscriptions',
    status: 'needs-review',
  },
]

const weeklyPrediction = {
  predicted: 11500,
  budget: 10000,
  confidence: 85,
  factors: [
    'Weekend coming up (+฿2,000 expected)',
    'Electricity bill due (+฿1,800)',
    'Grocery shopping day (-฿500 from usual)',
  ],
}

const financialHealth = {
  score: 72,
  category: 'Good',
  factors: [
    { name: 'Savings Rate', score: 65, status: 'needs-improvement' },
    { name: 'Budget Adherence', score: 78, status: 'good' },
    { name: 'Debt Management', score: 85, status: 'excellent' },
    { name: 'Emergency Fund', score: 60, status: 'needs-improvement' },
  ],
}

function InsightCard({
  type,
  title,
  description,
  impact,
  amount,
  change,
}: {
  type: string
  title: string
  description: string
  impact: string
  amount?: number
  change?: string
}) {
  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="size-5 text-warning" />
      case 'positive':
        return <TrendingUp className="size-5 text-primary" />
      default:
        return <Lightbulb className="size-5 text-chart-2" />
    }
  }

  const getBgColor = () => {
    switch (type) {
      case 'warning':
        return 'bg-warning/10 border-warning/20'
      case 'positive':
        return 'bg-primary/10 border-primary/20'
      default:
        return 'bg-chart-2/10 border-chart-2/20'
    }
  }

  return (
    <Card className={cn('border', getBgColor())}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{getIcon()}</div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{title}</h4>
              <Badge
                variant="secondary"
                className={cn(
                  'text-xs',
                  impact === 'high' && 'bg-destructive/20 text-destructive',
                  impact === 'medium' && 'bg-warning/20 text-warning',
                  impact === 'low' && 'bg-primary/20 text-primary'
                )}
              >
                {impact} impact
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            {(amount || change) && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                {amount && (
                  <span className="font-medium tabular-nums">
                    ฿{amount.toLocaleString()}
                  </span>
                )}
                {change && (
                  <Badge variant="outline" className="text-xs">
                    {change}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function InsightsPage() {
  const [isRefreshing, setIsRefreshing] = React.useState(false)

  const handleRefresh = () => {
    setIsRefreshing(true)
    setTimeout(() => setIsRefreshing(false), 2000)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Insights</h1>
            <p className="text-muted-foreground">
              Smart analysis powered by Claude AI
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn('mr-2 size-4', isRefreshing && 'animate-spin')} />
          Refresh Insights
        </Button>
      </div>

      {/* Financial Health Score */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5">
        <CardContent className="p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-6">
              <div className="relative">
                <svg className="size-24 -rotate-90">
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    className="text-muted"
                  />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke="currentColor"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${financialHealth.score * 2.51} 251`}
                    className="text-primary transition-all duration-1000"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold">{financialHealth.score}</span>
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">Financial Health Score</h3>
                <p className="text-muted-foreground">
                  Your overall financial health is{' '}
                  <span className="font-medium text-primary">{financialHealth.category}</span>
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {financialHealth.factors.map((factor) => (
                <div key={factor.name} className="flex items-center gap-2">
                  {factor.status === 'excellent' ? (
                    <CheckCircle2 className="size-4 text-primary" />
                  ) : factor.status === 'good' ? (
                    <CheckCircle2 className="size-4 text-chart-2" />
                  ) : (
                    <XCircle className="size-4 text-warning" />
                  )}
                  <span className="text-sm">{factor.name}</span>
                  <span className="text-sm font-medium">{factor.score}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="size-5 text-primary" />
            <CardTitle>Monthly Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground leading-relaxed">{monthlyInsights.summary}</p>
        </CardContent>
      </Card>

      {/* Insights Tabs */}
      <Tabs defaultValue="highlights" className="w-full">
        <TabsList>
          <TabsTrigger value="highlights" className="gap-2">
            <Lightbulb className="size-4" />
            Key Highlights
          </TabsTrigger>
          <TabsTrigger value="predictions" className="gap-2">
            <TrendingUp className="size-4" />
            Predictions
          </TabsTrigger>
          <TabsTrigger value="unusual" className="gap-2">
            <AlertTriangle className="size-4" />
            Unusual Activity
          </TabsTrigger>
        </TabsList>

        <TabsContent value="highlights" className="mt-4">
          <div className="grid gap-4 md:grid-cols-2">
            {monthlyInsights.highlights.map((insight, index) => (
              <InsightCard key={index} {...insight} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="predictions" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Next Week Spending Prediction</CardTitle>
                <CardDescription>AI-powered forecast based on your patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Predicted Spending</p>
                    <p className="text-3xl font-bold">
                      ฿{weeklyPrediction.predicted.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="text-xl font-medium">
                      ฿{weeklyPrediction.budget.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span>Confidence</span>
                    <span>{weeklyPrediction.confidence}%</span>
                  </div>
                  <Progress value={weeklyPrediction.confidence} className="h-2" />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-2">Contributing Factors</p>
                  <ul className="space-y-1">
                    {weeklyPrediction.factors.map((factor, index) => (
                      <li
                        key={index}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <ChevronRight className="size-3" />
                        {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Savings Projection</CardTitle>
                <CardDescription>If you maintain current spending habits</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="rounded-lg bg-primary/10 p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <PiggyBank className="size-4" />
                    End of Month Savings
                  </div>
                  <p className="mt-2 text-3xl font-bold text-primary">฿14,000</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    20% of projected income
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-3">At this rate, you&apos;ll reach:</p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span>Emergency Fund Goal</span>
                      <Badge variant="secondary">4 months</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Vacation Goal</span>
                      <Badge variant="secondary">2 months</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>New Laptop Goal</span>
                      <Badge variant="secondary">2 months</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="unusual" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Unusual Spending Alerts</CardTitle>
              <CardDescription>
                Transactions that differ from your usual patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unusualSpending.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-10 items-center justify-center rounded-full',
                          item.status === 'flagged'
                            ? 'bg-warning/20 text-warning'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        <AlertTriangle className="size-5" />
                      </div>
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {item.category}
                          </Badge>
                          <span>
                            {new Date(item.date).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-semibold tabular-nums">
                        ฿{item.amount.toLocaleString()}
                      </span>
                      <Button variant="outline" size="sm">
                        Review
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Budgeting Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Personalized Recommendations</CardTitle>
          <CardDescription>AI-generated tips to improve your finances</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {budgetingTips.map((tip, index) => (
              <Card key={index} className="border-dashed">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary mb-3">
                    <tip.icon className="size-5" />
                    <span className="font-medium">{tip.title}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{tip.description}</p>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Potential Savings</p>
                      <p className="font-semibold text-primary">
                        ฿{tip.potential.toLocaleString()}/mo
                      </p>
                    </div>
                    <Badge variant="secondary">{tip.difficulty}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Last Updated */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
        <Clock className="size-4" />
        <span>Last updated: {new Date().toLocaleString()}</span>
      </div>
    </div>
  )
}
