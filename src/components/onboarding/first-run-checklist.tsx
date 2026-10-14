'use client'

import * as React from 'react'
import Link from 'next/link'
import { CheckCircle2, Circle, X } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLocale } from '@/components/locale-provider'
import { useQuickAdd } from '@/components/quick-add-context'
import { useAuth } from '@/hooks/use-auth'
import { useFriends } from '@/hooks/use-friends'
import { useTrips } from '@/hooks/use-trips'
import { useUserSettings } from '@/hooks/use-user-settings'
import { readIntent, readOnboarding, writeOnboarding, type OnboardingIntent } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

type Step = {
  id: string
  done: boolean
  label: string
  hint: string
  action: { label: string; href?: string; onClick?: () => void }
  optional?: boolean
}

function useOnboardingState(uid: string | undefined) {
  const [state, setState] = React.useState<{ dismissed: boolean; intent: OnboardingIntent | null }>(
    { dismissed: true, intent: null }
  )
  React.useEffect(() => {
    const sync = () =>
      setState({ dismissed: readOnboarding(uid, 'checklist') === 'dismissed', intent: readIntent(uid) })
    sync()
    window.addEventListener('ft:onboarding', sync)
    return () => window.removeEventListener('ft:onboarding', sync)
  }, [uid])
  return state
}

/** Getting-started list shown until every step is done or the user hides it. */
export function FirstRunChecklist({ hasEntries }: { hasEntries: boolean }) {
  const { user } = useAuth()
  const uid = user?.uid
  const { p } = useLocale()
  const { openQuickAdd } = useQuickAdd()
  const { contacts, loading: friendsLoading } = useFriends()
  const { trips, loading: tripsLoading } = useTrips()
  const { profile, accountsEnabled, loading: settingsLoading } = useUserSettings()
  const { dismissed, intent } = useOnboardingState(uid)

  const hasFriend = contacts.some((c) => !c.isSelf)
  const steps: Step[] = [
    {
      id: 'entry',
      done: hasEntries,
      label: p({ th: 'จดรายการแรก', en: 'Log your first entry', zh: '记录第一笔' }),
      hint: p({ th: 'ใส่จำนวนเงินแล้วกดบันทึก', en: 'Enter an amount and save', zh: '输入金额并保存' }),
      action: { label: p({ th: 'จดเลย', en: 'Add', zh: '添加' }), onClick: () => openQuickAdd() },
    },
    {
      id: 'line',
      done: Boolean(profile?.lineUserId),
      label: p({ th: 'เชื่อม LINE', en: 'Connect LINE', zh: '连接 LINE' }),
      hint: p({
        th: 'พิมพ์ "ข้าว 45" ในแชตก็บันทึกได้ ไม่ต้องเปิดเว็บ',
        en: 'Text "lunch 45" in chat to log without opening the app',
        zh: '在聊天里发"午饭 45"即可记账',
      }),
      action: { label: p({ th: 'เชื่อม', en: 'Connect', zh: '连接' }), href: '/line' },
    },
    intent === 'trips'
      ? {
          id: 'trip',
          done: trips.length > 0,
          label: p({ th: 'สร้างทริปแรก', en: 'Create your first trip', zh: '创建第一个旅行' }),
          hint: p({
            th: 'ชวนเพื่อนเข้าทริป แล้วจดบิลรวมกันได้',
            en: 'Invite friends and log shared bills together',
            zh: '邀请朋友一起记录共同账单',
          }),
          action: { label: p({ th: 'สร้าง', en: 'Create', zh: '创建' }), href: '/trips' },
        }
      : {
          id: 'friend',
          done: hasFriend,
          label: p({ th: 'เพิ่มเพื่อนที่หารด้วยบ่อย', en: 'Add a friend you split with', zh: '添加常一起分摊的朋友' }),
          hint: p({
            th: 'เพื่อนไม่ต้องมีบัญชีก็หารได้',
            en: "Friends don't need an account",
            zh: '朋友无需注册账号',
          }),
          action: { label: p({ th: 'เพิ่ม', en: 'Add', zh: '添加' }), href: '/friends' },
          optional: intent === 'solo',
        },
    {
      id: 'accounts',
      done: accountsEnabled,
      label: p({ th: 'แยกยอดตามบัญชี/กระเป๋าเงิน', en: 'Track balances per account', zh: '按账户追踪余额' }),
      hint: p({
        th: 'ไม่บังคับ — เปิดเมื่ออยากรู้ยอดคงเหลือแต่ละบัญชี',
        en: 'Optional — turn on to see each account balance',
        zh: '可选——开启后查看各账户余额',
      }),
      action: { label: p({ th: 'ตั้งค่า', en: 'Set up', zh: '设置' }), href: '/settings?tab=money' },
      optional: true,
    },
  ]

  const required = steps.filter((s) => !s.optional)
  const doneCount = steps.filter((s) => s.done).length
  const allRequiredDone = required.every((s) => s.done)
  const loading = friendsLoading || tripsLoading || settingsLoading

  if (!uid || dismissed || loading || allRequiredDone) return null

  return (
    <Card className="border-primary/30 bg-primary/[0.03] shadow-sm">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight">
              {p({ th: 'เริ่มต้นใช้งาน', en: 'Getting started', zh: '快速上手' })}
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {p({
                th: `เสร็จแล้ว ${doneCount} จาก ${steps.length}`,
                en: `${doneCount} of ${steps.length} done`,
                zh: `已完成 ${doneCount}/${steps.length}`,
              })}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0 text-muted-foreground"
            onClick={() => writeOnboarding(uid, 'checklist', 'dismissed')}
            aria-label={p({ th: 'ซ่อนรายการเริ่มต้นใช้งาน', en: 'Hide getting started', zh: '隐藏快速上手' })}
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
        <ol className="divide-y divide-border rounded-lg border bg-background">
          {steps.map((step) => (
            <li key={step.id} className="flex items-center gap-3 px-3 py-2.5">
              {step.done ? (
                <CheckCircle2 className="size-5 shrink-0 text-primary" aria-hidden />
              ) : (
                <Circle className="size-5 shrink-0 text-muted-foreground/60" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground line-through')}>
                  {step.label}
                  <span className="sr-only">
                    {step.done ? p({ th: ' (เสร็จแล้ว)', en: ' (done)', zh: '（已完成）' }) : ''}
                  </span>
                </p>
                {!step.done && <p className="text-xs text-muted-foreground">{step.hint}</p>}
              </div>
              {!step.done &&
                (step.action.href ? (
                  <Button variant="outline" size="sm" className="h-9 shrink-0" asChild>
                    <Link href={step.action.href}>{step.action.label}</Link>
                  </Button>
                ) : (
                  <Button size="sm" className="h-9 shrink-0" onClick={step.action.onClick}>
                    {step.action.label}
                  </Button>
                ))}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  )
}
