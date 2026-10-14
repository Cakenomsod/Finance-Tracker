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
import { useLocale } from '@/components/locale-provider'
import type { LocalizedText } from '@/lib/i18n'

function insightLabel(type: DashboardInsight['type']): LocalizedText {
  switch (type) {
    case 'alert':
      return { th: 'ใช้เงินเยอะผิดปกติ', en: 'Spending alert', zh: '支出提醒' }
    case 'pattern':
      return { th: 'รูปแบบการใช้เงิน', en: 'Pattern', zh: '消费规律' }
    case 'tip':
      return { th: 'คำแนะนำ', en: 'Tip', zh: '小建议' }
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
  const { t, p } = useLocale()
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="text-balance">{t('nav.insights')}</CardTitle>
        <CardDescription className="text-pretty">
          {p({
            th: 'สิ่งที่น่าสังเกตในการใช้เงินเดือนนี้',
            en: "What stands out in this month's spending",
            zh: '本月支出中值得注意的地方',
          })}
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
                      {p(insightLabel(insight.type))}
                    </span>
                  </p>
                  <p className="mt-1 break-words text-sm text-pretty">{insight.text}</p>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-3 py-5 text-center">
              <p className="text-sm font-medium">
                {p({ th: 'ยังไม่มีข้อสังเกต', en: 'No insights yet', zh: '暂无洞察' })}
              </p>
              <p className="mt-1 text-sm text-muted-foreground text-pretty">
                {p({
                  th: 'บันทึกรายการสักหน่อย แล้วจะเห็นรูปแบบการใช้เงินตรงนี้',
                  en: 'Add a few transactions and patterns will show up here.',
                  zh: '添加几笔交易后，消费规律就会显示在这里。',
                })}
              </p>
            </div>
          )}
        </MonthContentTransition>
        <Button variant="outline" className="mt-auto w-full" asChild>
          <Link href="/insights">
            {p({ th: 'ดูบทวิเคราะห์ทั้งหมด', en: 'View all insights', zh: '查看全部分析' })}
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
