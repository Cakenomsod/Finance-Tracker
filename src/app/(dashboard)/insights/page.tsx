'use client'

import * as React from 'react'
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Zap,
  Clock,
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Hash,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { MonthPicker } from '@/components/shared/month-picker'
import { WeekPicker } from '@/components/shared/week-picker'
import { useAiInsight } from '@/hooks/use-ai-insight'
import { useUserSettings } from '@/hooks/use-user-settings'
import { formatMoney } from '@/lib/aggregate-transactions'
import { toDateFromFirestore, type MonthSelection, getCurrentMonthSelection } from '@/lib/datetime'
import {
  formatMonthKey,
  formatWeekKey,
  getCurrentWeekSelection,
  type WeekSelection,
} from '@/lib/insight-periods'
import type {
  AiInsightAnomaly,
  AiInsightHighlight,
  AiInsightPeriodType,
  AiInsightTip,
} from '@/lib/firestore-types'
import { cn } from '@/lib/utils'

function InsightCard({
  highlight,
  currency,
}: {
  highlight: AiInsightHighlight
  currency: string
}) {
  const getIcon = () => {
    switch (highlight.type) {
      case 'warning':
        return <AlertTriangle className="size-5 text-warning" />
      case 'positive':
        return <TrendingUp className="size-5 text-primary" />
      default:
        return <Lightbulb className="size-5 text-chart-2" />
    }
  }

  const getBgColor = () => {
    switch (highlight.type) {
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
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-medium">{highlight.title}</h4>
              <Badge
                variant="secondary"
                className={cn(
                  'shrink-0 text-xs',
                  highlight.impact === 'high' && 'bg-destructive/20 text-destructive',
                  highlight.impact === 'medium' && 'bg-warning/20 text-warning',
                  highlight.impact === 'low' && 'bg-primary/20 text-primary'
                )}
              >
                {highlight.impact} impact
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{highlight.description}</p>
            {(highlight.amount != null || highlight.change) && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                {highlight.amount != null && (
                  <span className="font-medium tabular-nums">
                    {formatMoney(highlight.amount, currency)}
                  </span>
                )}
                {highlight.change && (
                  <Badge variant="outline" className="text-xs">
                    {highlight.change}
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

function TipCard({ tip, currency }: { tip: AiInsightTip; currency: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Lightbulb className="size-5 shrink-0" />
          <span className="font-medium">{tip.title}</span>
        </div>
        <p className="text-sm text-muted-foreground">{tip.description}</p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <div>
            {tip.potentialSavings != null && tip.potentialSavings > 0 ? (
              <>
                <p className="text-xs text-muted-foreground">Potential Savings</p>
                <p className="font-semibold text-primary tabular-nums">
                  {formatMoney(tip.potentialSavings, currency)}
                </p>
              </>
            ) : (
              <span className="text-xs text-muted-foreground">Tip</span>
            )}
          </div>
          <Badge variant="secondary">{tip.difficulty}</Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function AnomalyRow({ anomaly }: { anomaly: AiInsightAnomaly }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-full',
            anomaly.severity === 'high'
              ? 'bg-destructive/20 text-destructive'
              : anomaly.severity === 'medium'
                ? 'bg-warning/20 text-warning'
                : 'bg-muted text-muted-foreground'
          )}
        >
          <AlertTriangle className="size-5" />
        </div>
        <div>
          <p className="font-medium">{anomaly.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{anomaly.description}</p>
        </div>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          'shrink-0 text-xs capitalize',
          anomaly.severity === 'high' && 'bg-destructive/20 text-destructive',
          anomaly.severity === 'medium' && 'bg-warning/20 text-warning'
        )}
      >
        {anomaly.severity}
      </Badge>
    </div>
  )
}

function InsightsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading insights">
      <Card>
        <CardContent className="grid gap-4 p-4 sm:grid-cols-4 sm:p-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-28" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    </div>
  )
}

function formatGeneratedAt(
  value: AiInsightReportLike['generatedAt'],
  locale?: string
): string | null {
  if (!value) return null
  if (typeof value === 'string') {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString(locale || undefined)
  }
  const d = toDateFromFirestore(value)
  return d ? d.toLocaleString(locale || undefined) : null
}

/** API may serialize Timestamp as `{ seconds }` or ISO string. */
type AiInsightReportLike = {
  generatedAt?: Parameters<typeof toDateFromFirestore>[0] | string
  status: 'ready' | 'generating' | 'failed'
  errorMessage?: string | null
  summary: string
  highlights: AiInsightHighlight[]
  tips: AiInsightTip[]
  anomalies: AiInsightAnomaly[]
  stats: {
    totalIncome: number
    totalExpense: number
    net: number
    transactionCount: number
    vsPriorExpenseChangePercent?: number | null
    savingsRate?: number | null
  }
}

export default function InsightsPage() {
  const { currency, locale } = useUserSettings()
  const [periodType, setPeriodType] = React.useState<AiInsightPeriodType>('month')
  const [monthSelection, setMonthSelection] = React.useState<MonthSelection>(
    getCurrentMonthSelection
  )
  const [weekSelection, setWeekSelection] = React.useState<WeekSelection>(
    getCurrentWeekSelection
  )

  const periodKey =
    periodType === 'month'
      ? formatMonthKey(monthSelection)
      : formatWeekKey(weekSelection)

  const { report, loading, generating, error, generate, refresh } = useAiInsight(
    periodType,
    periodKey
  )

  const busy = loading || generating
  const displayLocale = locale === 'th' ? 'th-TH' : locale === 'en' ? 'en-US' : undefined

  const handlePeriodTypeChange = (value: string) => {
    if (value === 'week' || value === 'month') {
      setPeriodType(value)
    }
  }

  const handleRefresh = () => {
    void refresh({ force: true })
  }

  const handleGenerate = () => {
    void generate({ force: true })
  }

  const showGenerating = generating || report?.status === 'generating'
  const showEmpty = !loading && !showGenerating && !error && !report
  const showFailed =
    !loading &&
    !showGenerating &&
    (Boolean(error) || report?.status === 'failed')
  const showReady = !loading && !showGenerating && report?.status === 'ready'

  const generatedLabel = report
    ? formatGeneratedAt(report.generatedAt as AiInsightReportLike['generatedAt'], displayLocale)
    : null

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">AI Insights</h1>
            <p className="text-muted-foreground">
              Smart analysis powered by Gemini
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={busy}>
          <RefreshCw className={cn('mr-2 size-4', generating && 'animate-spin')} />
          Refresh Insights
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ToggleGroup
          type="single"
          variant="outline"
          value={periodType}
          onValueChange={handlePeriodTypeChange}
          className="justify-start"
        >
          <ToggleGroupItem value="week" aria-label="Week">
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Month">
            Month
          </ToggleGroupItem>
        </ToggleGroup>

        {periodType === 'month' ? (
          <MonthPicker value={monthSelection} onChange={setMonthSelection} />
        ) : (
          <WeekPicker
            value={weekSelection}
            onChange={setWeekSelection}
            locale={displayLocale || 'th-TH'}
          />
        )}
      </div>

      {loading && <InsightsSkeleton />}

      {!loading && showGenerating && (
        <Card>
          <CardContent className="flex items-center justify-center gap-3 p-8 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" />
            <span>Generating insights…</span>
          </CardContent>
        </Card>
      )}

      {showFailed && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold">Couldn&apos;t load insights</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {report?.errorMessage || error || 'Something went wrong. Please try again.'}
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <RefreshCw className={cn('mr-2 size-4', generating && 'animate-spin')} />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {showEmpty && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="size-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">No insights for this period</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Generate an AI summary of your income, spending, and unusual activity
                for the selected {periodType}.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating}>
              <Zap className={cn('mr-2 size-4', generating && 'animate-pulse')} />
              {generating ? 'Generating…' : 'Generate Insights'}
            </Button>
          </CardContent>
        </Card>
      )}

      {showReady && report && (
        <>
          <Card>
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
              <StatCell
                label="Income"
                value={formatMoney(report.stats.totalIncome, currency)}
                icon={<ArrowUpRight className="size-4 text-primary" />}
              />
              <StatCell
                label="Expenses"
                value={formatMoney(report.stats.totalExpense, currency)}
                icon={<ArrowDownRight className="size-4 text-destructive" />}
              />
              <StatCell
                label="Net"
                value={formatMoney(report.stats.net, currency, true)}
                icon={<Wallet className="size-4 text-muted-foreground" />}
              />
              <StatCell
                label="Transactions"
                value={String(report.stats.transactionCount)}
                icon={<Hash className="size-4 text-muted-foreground" />}
                hint={
                  report.stats.vsPriorExpenseChangePercent != null
                    ? `Expenses ${report.stats.vsPriorExpenseChangePercent > 0 ? '+' : ''}${Math.round(report.stats.vsPriorExpenseChangePercent)}% vs prior`
                    : report.stats.savingsRate != null
                      ? `Savings rate ${Math.round(report.stats.savingsRate)}%`
                      : undefined
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Zap className="size-5 text-primary" />
                <CardTitle>
                  {periodType === 'month' ? 'Monthly Summary' : 'Weekly Summary'}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="leading-relaxed text-muted-foreground">{report.summary}</p>
            </CardContent>
          </Card>

          <Tabs defaultValue="highlights" className="w-full">
            <TabsList>
              <TabsTrigger value="highlights" className="gap-2">
                <Lightbulb className="size-4" />
                Key Highlights
              </TabsTrigger>
              <TabsTrigger value="tips" className="gap-2">
                <TrendingUp className="size-4" />
                Tips
              </TabsTrigger>
              <TabsTrigger value="unusual" className="gap-2">
                <AlertTriangle className="size-4" />
                Unusual Activity
              </TabsTrigger>
            </TabsList>

            <TabsContent value="highlights" className="mt-4">
              {report.highlights.length === 0 ? (
                <EmptyTab message="No highlights for this period." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {report.highlights.map((highlight, index) => (
                    <InsightCard
                      key={`${highlight.title}-${index}`}
                      highlight={highlight}
                      currency={currency}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="tips" className="mt-4">
              {report.tips.length === 0 ? (
                <EmptyTab message="No tips for this period." />
              ) : (
                <div className="grid gap-4 md:grid-cols-3">
                  {report.tips.map((tip, index) => (
                    <TipCard key={`${tip.title}-${index}`} tip={tip} currency={currency} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="unusual" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Unusual Activity</CardTitle>
                  <CardDescription>
                    Patterns and transactions that differ from your usual habits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.anomalies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No unusual activity flagged for this period.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {report.anomalies.map((anomaly, index) => (
                        <AnomalyRow key={`${anomaly.title}-${index}`} anomaly={anomaly} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {generatedLabel && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-4" />
              <span>Last updated: {generatedLabel}</span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatCell({
  label,
  value,
  icon,
  hint,
}: {
  label: string
  value: string
  icon: React.ReactNode
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function EmptyTab({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center text-sm text-muted-foreground">
        {message}
      </CardContent>
    </Card>
  )
}
