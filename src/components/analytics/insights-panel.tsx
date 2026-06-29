'use client'

import Link from 'next/link'
import { Sparkles } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  MonthContentTransition,
  type MonthDirection,
} from '@/components/shared/month-transition'
import { cn } from '@/lib/utils'
import type { DashboardInsight } from '@/lib/aggregate-transactions'

function insightLabel(type: DashboardInsight['type']) {
  switch (type) {
    case 'alert':
      return 'Spending Alert:'
    case 'pattern':
      return 'Pattern Detected:'
    case 'tip':
      return 'Savings Tip:'
  }
}

export function InsightsPanel({
  insights,
  monthKey,
  monthDirection,
}: {
  insights: DashboardInsight[]
  monthKey: string
  monthDirection: MonthDirection
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-muted p-2">
            <Sparkles className="size-4 text-primary" />
          </div>
          <CardTitle>Insights</CardTitle>
        </div>
        <CardDescription>Observations from your spending data</CardDescription>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
        <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
          {insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, i) => (
                <p key={i} className="break-words text-sm">
                  <span
                    className={cn(
                      'font-medium',
                      insight.type === 'alert' && 'text-warning',
                      (insight.type === 'pattern' || insight.type === 'tip') && 'text-primary'
                    )}
                  >
                    {insightLabel(insight.type)}
                  </span>{' '}
                  {insight.text}
                </p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Add transactions to see personalized insights.
            </p>
          )}
        </MonthContentTransition>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/insights">View All Insights</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
