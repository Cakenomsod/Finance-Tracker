'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/aggregate-transactions'

export function DebtSummaryCard({
  totalOwed,
  totalOwedToYou,
  netBalance,
  uniqueOwePeople,
  uniqueOwedPeople,
  currency,
}: {
  totalOwed: number
  totalOwedToYou: number
  netBalance: number
  uniqueOwePeople: number
  uniqueOwedPeople: number
  currency: string
}) {
  const hasActivity = totalOwed > 0 || totalOwedToYou > 0

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 sm:px-6">
        <div className="min-w-0">
          <CardTitle className="text-balance">Shared balances</CardTitle>
          <CardDescription className="text-pretty">
            Who owes whom across debts and trips
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" asChild>
          <Link href="/debts">View all</Link>
        </Button>
      </CardHeader>
      <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
        {hasActivity ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowUpRight className="size-4 shrink-0 text-destructive" aria-hidden />
                    <span className="text-sm font-medium">You owe</span>
                  </div>
                  <span className="shrink-0 text-base font-semibold text-destructive tabular-nums sm:text-lg">
                    {formatMoney(totalOwed, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uniqueOwePeople} {uniqueOwePeople === 1 ? 'person' : 'people'}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowDownLeft className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-sm font-medium">Owed to you</span>
                  </div>
                  <span className="shrink-0 text-base font-semibold text-primary tabular-nums sm:text-lg">
                    {formatMoney(totalOwedToYou, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {uniqueOwedPeople} {uniqueOwedPeople === 1 ? 'person' : 'people'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">Net with friends</span>
              <span
                className={cn(
                  'shrink-0 text-base font-semibold tabular-nums sm:text-lg',
                  netBalance >= 0 ? 'text-primary' : 'text-destructive'
                )}
              >
                {formatMoney(netBalance, currency, true)}
              </span>
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
            <p className="text-sm font-medium">No open shared balances</p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              Split a trip or add a debt to track who owes whom.
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/debts">Go to debts</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
