'use client'

import Link from 'next/link'
import { ArrowDownLeft, ArrowUpRight } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatMoney } from '@/lib/aggregate-transactions'
import { useLocale } from '@/components/locale-provider'

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
  const { p } = useLocale()
  const hasActivity = totalOwed > 0 || totalOwedToYou > 0
  const peopleLabel = (count: number) =>
    p({
      th: `${count} คน`,
      en: `${count} ${count === 1 ? 'person' : 'people'}`,
      zh: `${count} 人`,
    })

  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="flex flex-row items-start justify-between gap-2 px-4 sm:px-6">
        <div className="min-w-0">
          <CardTitle className="text-balance">
            {p({ th: 'ใครติดใคร', en: 'Shared balances', zh: '共同账目' })}
          </CardTitle>
          <CardDescription className="text-pretty">
            {p({
              th: 'ยอดค้างระหว่างคุณกับเพื่อน ทั้งจากหนี้และทริป',
              en: 'Who owes whom across debts and trips',
              zh: '借款和行程中谁欠谁',
            })}
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" className="shrink-0" asChild>
          <Link href="/debts">{p({ th: 'ดูทั้งหมด', en: 'View all', zh: '查看全部' })}</Link>
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
                    <span className="text-sm font-medium">
                      {p({ th: 'คุณต้องจ่ายคืน', en: 'You owe', zh: '你欠别人' })}
                    </span>
                  </div>
                  <span className="shrink-0 text-base font-semibold text-destructive tabular-nums sm:text-lg">
                    {formatMoney(totalOwed, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {peopleLabel(uniqueOwePeople)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border border-border bg-muted/40 p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ArrowDownLeft className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="text-sm font-medium">
                      {p({ th: 'มีคนต้องจ่ายคืนคุณ', en: 'Owed to you', zh: '别人欠你' })}
                    </span>
                  </div>
                  <span className="shrink-0 text-base font-semibold text-primary tabular-nums sm:text-lg">
                    {formatMoney(totalOwedToYou, currency)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {peopleLabel(uniqueOwedPeople)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 border-t pt-4">
              <span className="text-sm text-muted-foreground">
                {p({ th: 'ยอดสุทธิกับเพื่อน', en: 'Net with friends', zh: '与朋友的净额' })}
              </span>
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
            <p className="text-sm font-medium">
              {p({ th: 'ไม่มียอดค้างกับใคร', en: 'No open shared balances', zh: '没有未结的共同账目' })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground text-pretty">
              {p({
                th: 'หารค่าใช้จ่ายในทริป หรือจดว่าใครยืมเงินใคร เพื่อดูว่าใครติดใคร',
                en: 'Split a trip or add a debt to track who owes whom.',
                zh: '分摊行程费用或添加借款，即可追踪谁欠谁。',
              })}
            </p>
            <Button variant="outline" size="sm" className="mt-4" asChild>
              <Link href="/debts">{p({ th: 'ไปหน้าหนี้ & หาร', en: 'Go to debts', zh: '前往债务' })}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
