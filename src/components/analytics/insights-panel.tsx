'use client'

import Link from 'next/link'

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
      return 'Spending alert'
    case 'pattern':
      return 'Pattern'
    case 'tip':
      return 'Tip'
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
        <CardTitle className="text-balance">Insights</CardTitle>
        <CardDescription className="text-pretty">
          What stands out in this month&apos;s spending
        </CardDescription>
      </CardHeader>
      <CardContent className="flex min-w-0 flex-col gap-4 px-4 sm:px-6">
        <MonthContentTransition monthKey={monthKey} direction={monthDirection}>
          {insights.length > 0 ? (
            <ul className="space-y-0 divide-y divide-border">
              {insights.map((insight, i) => (
                <li key={i} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    <span
                      className={cn(
                        insight.type === 'alert' && 'text-warning',
                        insight.type === 'pattern' && 'text-foreground',
                        insight.type === 'tip' && 'text-primary'
                      )}
                    >
                      {insightLabel(insight.type)}
                    </span>
                  </p>
                  <p className="mt-1 break-words text-sm text-pretty">{insight.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center">
              <p className="text-sm font-medium">No insights yet</p>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                Add a few transactions and patterns will show up here.
              </p>
            </div>
          )}
        </MonthContentTransition>
        <Button variant="outline" className="mt-auto w-full" asChild>
          <Link href="/insights">View all insights</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
