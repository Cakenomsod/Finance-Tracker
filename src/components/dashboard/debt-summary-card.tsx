'use client'

import Link from 'next/link'
import { CreditCard, Users } from 'lucide-react'

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
  return (
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
              {formatMoney(totalOwed, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {uniqueOwePeople} {uniqueOwePeople === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="rounded-lg bg-primary/10 p-3 sm:p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <CreditCard className="size-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">Owed to You</span>
            </div>
            <span className="shrink-0 text-base font-bold text-primary tabular-nums sm:text-lg">
              {formatMoney(totalOwedToYou, currency)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {uniqueOwedPeople} {uniqueOwedPeople === 1 ? 'person' : 'people'}
          </p>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-4">
          <span className="text-sm text-muted-foreground">Net Balance</span>
          <span
            className={cn(
              'shrink-0 text-base font-bold tabular-nums sm:text-lg',
              netBalance >= 0 ? 'text-primary' : 'text-destructive'
            )}
          >
            {formatMoney(netBalance, currency, true)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
