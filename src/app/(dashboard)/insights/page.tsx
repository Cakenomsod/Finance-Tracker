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
import { amountColorClass, cn } from '@/lib/utils'

const IMPACT_LABEL: Record<AiInsightHighlight['impact'], string> = {
  high: 'High impact',
  medium: 'Medium impact',
  low: 'Low impact',
}

const SEVERITY_LABEL: Record<AiInsightAnomaly['severity'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

function highlightTone(type: AiInsightHighlight['type']) {
  switch (type) {
    case 'warning':
      return {
        icon: <AlertTriangle className="size-4 text-warning" aria-hidden />,
        label: 'Warning',
      }
    case 'positive':
      return {
        icon: <TrendingUp className="size-4 text-primary" aria-hidden />,
        label: 'Positive',
      }
    default:
      return {
        icon: <Lightbulb className="size-4 text-muted-foreground" aria-hidden />,
        label: 'Insight',
      }
  }
}

function InsightCard({
  highlight,
  currency,
  className,
  style,
}: {
  highlight: AiInsightHighlight
  currency: string
  className?: string
  style?: React.CSSProperties
}) {
  const tone = highlightTone(highlight.type)

  return (
    <Card className={cn('shadow-sm', className)} style={style}>
      <CardContent className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
              {tone.icon}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{tone.label}</p>
              <h3 className="text-sm font-semibold text-balance leading-snug">{highlight.title}</h3>
            </div>
          </div>
          <Badge
            variant="secondary"
            className={cn(
              'shrink-0 text-xs',
              highlight.impact === 'high' && 'bg-destructive/15 text-destructive',
              highlight.impact === 'medium' && 'bg-warning/15 text-warning',
              highlight.impact === 'low' && 'bg-primary/15 text-primary'
            )}
          >
            {IMPACT_LABEL[highlight.impact]}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground text-pretty">{highlight.description}</p>

        {(highlight.amount != null || highlight.change) && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {highlight.amount != null && (
              <span className="font-semibold tabular-nums">
                {formatMoney(highlight.amount, currency)}
              </span>
            )}
            {highlight.change && (
              <Badge variant="outline" className="font-normal">
                {highlight.change}
              </Badge>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TipRow({ tip, currency }: { tip: AiInsightTip; currency: string }) {
  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start gap-2">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <h3 className="text-sm font-semibold text-balance leading-snug">{tip.title}</h3>
        </div>
        <p className="pl-6 text-sm text-muted-foreground text-pretty">{tip.description}</p>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-3 pl-6 sm:flex-col sm:items-end sm:pl-0">
        {tip.potentialSavings != null && tip.potentialSavings > 0 ? (
          <div className="text-left sm:text-right">
            <p className="text-xs text-muted-foreground">Potential savings</p>
            <p className="font-semibold text-primary tabular-nums">
              {formatMoney(tip.potentialSavings, currency)}
            </p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Suggestion</span>
        )}
        <Badge variant="secondary" className="capitalize">
          {tip.difficulty}
        </Badge>
      </div>
    </div>
  )
}

function AnomalyRow({ anomaly }: { anomaly: AiInsightAnomaly }) {
  return (
    <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <AlertTriangle
            className={cn(
              'size-4 shrink-0',
              anomaly.severity === 'high' && 'text-destructive',
              anomaly.severity === 'medium' && 'text-warning',
              anomaly.severity === 'low' && 'text-muted-foreground'
            )}
            aria-hidden
          />
          <p className="font-medium text-sm leading-snug text-balance">{anomaly.title}</p>
        </div>
        <p className="pl-6 text-sm text-muted-foreground text-pretty">{anomaly.description}</p>
      </div>
      <Badge
        variant="secondary"
        className={cn(
          'shrink-0 text-xs',
          anomaly.severity === 'high' && 'bg-destructive/15 text-destructive',
          anomaly.severity === 'medium' && 'bg-warning/15 text-warning'
        )}
      >
        {SEVERITY_LABEL[anomaly.severity]}
      </Badge>
    </div>
  )
}

function InsightsSkeleton({ status }: { status?: string }) {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label={status || 'Loading insights'}>
      {status && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {status}
        </p>
      )}
      <Card className="shadow-sm">
        <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2 border-b border-border/60 pb-4 last:border-0 sm:border-0 sm:pb-0">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-7 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
      <Card className="shadow-sm">
        <CardHeader className="gap-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/6" />
        </CardContent>
      </Card>
      <div className="space-y-3">
        <Skeleton className="h-9 w-full max-w-md rounded-lg" />
        <div className="grid gap-3 md:grid-cols-2">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
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
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">Insights</h1>
          <p className="text-muted-foreground text-pretty">
            Period analysis of your income, spending, and unusual activity
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={busy}
          aria-busy={busy}
          className="w-full shrink-0 sm:w-auto"
        >
          <RefreshCw
            className={cn(
              'mr-2 size-4',
              generating && 'animate-spin motion-reduce:animate-none'
            )}
            aria-hidden
          />
          {generating ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      <div
        role="group"
        aria-label="Insight period"
        className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-3"
      >
        <ToggleGroup
          type="single"
          variant="outline"
          value={periodType}
          onValueChange={handlePeriodTypeChange}
          className="justify-start"
          aria-label="Period type"
        >
          <ToggleGroupItem value="week" aria-label="Week" className="min-w-16">
            Week
          </ToggleGroupItem>
          <ToggleGroupItem value="month" aria-label="Month" className="min-w-16">
            Month
          </ToggleGroupItem>
        </ToggleGroup>

        <div className="flex justify-start sm:justify-end">
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
      </div>

      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {showGenerating
          ? 'Generating insights'
          : showFailed
            ? 'Insights failed to load'
            : showReady
              ? 'Insights ready'
              : showEmpty
                ? 'No insights for this period'
                : loading
                  ? 'Loading insights'
                  : ''}
      </div>

      {loading && <InsightsSkeleton />}

      {!loading && showGenerating && (
        <InsightsSkeleton status="Generating insights…" />
      )}

      {showFailed && (
        <Card className="border-destructive/30 shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangle className="size-6 text-destructive" aria-hidden />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-base font-semibold">Couldn&apos;t load insights</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                {report?.errorMessage || error || 'Something went wrong. Please try again.'}
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} aria-busy={generating}>
              <RefreshCw
                className={cn(
                  'mr-2 size-4',
                  generating && 'animate-spin motion-reduce:animate-none'
                )}
                aria-hidden
              />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {showEmpty && (
        <Card className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none">
          <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
              <Sparkles className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <div className="max-w-md space-y-1">
              <h2 className="text-base font-semibold">No insights for this period</h2>
              <p className="text-sm text-muted-foreground text-pretty">
                Generate a summary of your income, spending, and unusual activity for the selected{' '}
                {periodType}. Add a few transactions first if this period looks empty.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={generating} aria-busy={generating}>
              <Zap className="mr-2 size-4" aria-hidden />
              {generating ? 'Generating…' : 'Generate insights'}
            </Button>
          </CardContent>
        </Card>
      )}

      {showReady && report && (
        <div className="flex flex-col gap-6 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none">
          <Card className="shadow-sm">
            <CardContent className="grid gap-0 p-0 sm:grid-cols-2 lg:grid-cols-4">
              <StatCell
                label="Income"
                value={formatMoney(report.stats.totalIncome, currency)}
                icon={<ArrowUpRight className="size-3.5 text-primary" aria-hidden />}
                valueClassName="text-primary"
              />
              <StatCell
                label="Expenses"
                value={formatMoney(report.stats.totalExpense, currency)}
                icon={<ArrowDownRight className="size-3.5 text-destructive" aria-hidden />}
                valueClassName="text-destructive"
                className="border-t sm:border-t-0 sm:border-l"
              />
              <StatCell
                label="Net"
                value={formatMoney(report.stats.net, currency, true)}
                icon={<Wallet className="size-3.5 text-muted-foreground" aria-hidden />}
                valueClassName={amountColorClass(report.stats.net, 'text-foreground')}
                className="border-t lg:border-t-0 lg:border-l"
              />
              <StatCell
                label="Transactions"
                value={String(report.stats.transactionCount)}
                icon={<Hash className="size-3.5 text-muted-foreground" aria-hidden />}
                hint={
                  report.stats.vsPriorExpenseChangePercent != null
                    ? `Expenses ${report.stats.vsPriorExpenseChangePercent > 0 ? '+' : ''}${Math.round(report.stats.vsPriorExpenseChangePercent)}% vs prior`
                    : report.stats.savingsRate != null
                      ? `Savings rate ${Math.round(report.stats.savingsRate)}%`
                      : undefined
                }
                className="border-t sm:border-l lg:border-t-0"
              />
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="gap-1.5">
              <CardTitle className="text-base">
                {periodType === 'month' ? 'Monthly summary' : 'Weekly summary'}
              </CardTitle>
              <CardDescription>
                Plain-language read of this {periodType}&apos;s activity
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="max-w-prose text-sm leading-relaxed text-pretty text-foreground/90">
                {report.summary}
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="highlights" className="w-full gap-4">
            <TabsList
              className="grid h-auto w-full grid-cols-3 gap-1 p-1 sm:inline-flex sm:w-fit"
              aria-label="Insight sections"
            >
              <TabsTrigger value="highlights" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <Lightbulb className="size-3.5 sm:size-4" aria-hidden />
                <span className="truncate">Highlights</span>
              </TabsTrigger>
              <TabsTrigger value="tips" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <TrendingUp className="size-3.5 sm:size-4" aria-hidden />
                <span className="truncate">Tips</span>
              </TabsTrigger>
              <TabsTrigger value="unusual" className="gap-1.5 px-2 py-2 text-xs sm:text-sm">
                <AlertTriangle className="size-3.5 sm:size-4" aria-hidden />
                <span className="truncate">Unusual</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent
              value="highlights"
              className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
            >
              {report.highlights.length === 0 ? (
                <EmptyTab
                  title="No highlights yet"
                  message="Nothing stood out for this period. Try another week or month, or generate again after logging more transactions."
                />
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {report.highlights.map((highlight, index) => (
                    <InsightCard
                      key={`${highlight.title}-${index}`}
                      highlight={highlight}
                      currency={currency}
                      className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200 fill-mode-both motion-reduce:animate-none"
                      style={
                        {
                          animationDelay: `${Math.min(index, 5) * 40}ms`,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent
              value="tips"
              className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
            >
              {report.tips.length === 0 ? (
                <EmptyTab
                  title="No tips for this period"
                  message="Tips appear when there are clear ways to trim spending or improve cash flow. Check back after more activity."
                />
              ) : (
                <Card className="shadow-sm">
                  <CardHeader className="gap-1.5">
                    <CardTitle className="text-base">Suggestions</CardTitle>
                    <CardDescription>
                      Practical next steps based on this {periodType}&apos;s pattern
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="divide-y pt-0">
                    {report.tips.map((tip, index) => (
                      <TipRow key={`${tip.title}-${index}`} tip={tip} currency={currency} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent
              value="unusual"
              className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
            >
              <Card className="shadow-sm">
                <CardHeader className="gap-1.5">
                  <CardTitle className="text-base">Unusual activity</CardTitle>
                  <CardDescription>
                    Patterns and transactions that differ from your usual habits
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.anomalies.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-pretty">
                      No unusual activity flagged for this period — spending looks consistent with
                      your recent habits.
                    </p>
                  ) : (
                    <div className="divide-y">
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
            <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              <span>Last updated {generatedLabel}</span>
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function StatCell({
  label,
  value,
  icon,
  hint,
  valueClassName,
  className,
}: {
  label: string
  value: string
  icon: React.ReactNode
  hint?: string
  valueClassName?: string
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5 border-border/70 px-4 py-4 sm:px-5 sm:py-5', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <p
        className={cn(
          'text-lg font-semibold tracking-tight tabular-nums sm:text-xl',
          valueClassName
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-xs text-muted-foreground text-pretty">{hint}</p> : null}
    </div>
  )
}

function EmptyTab({ title, message }: { title: string; message: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/40 px-6 py-10 text-center">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-muted-foreground text-pretty">{message}</p>
    </div>
  )
}
