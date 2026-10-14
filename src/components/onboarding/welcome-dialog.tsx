'use client'

import * as React from 'react'
import { Plane, User, Users } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CurrencySelect } from '@/components/shared/currency-select'
import { useLocale } from '@/components/locale-provider'
import { useQuickAdd } from '@/components/quick-add-context'
import { useAuth } from '@/hooks/use-auth'
import { useTransactions } from '@/hooks/use-transactions-context'
import { useUserSettings } from '@/hooks/use-user-settings'
import type { AppLocale } from '@/lib/locale'
import { readOnboarding, writeOnboarding, type OnboardingIntent } from '@/lib/onboarding'
import { cn } from '@/lib/utils'

const LANGUAGES: { value: AppLocale; label: string }[] = [
  { value: 'th', label: 'ไทย' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
]

/** One skippable screen for brand-new accounts; existing users with data never see it. */
export function WelcomeDialog() {
  const { user } = useAuth()
  const uid = user?.uid
  const { transactions, loading } = useTransactions()
  const { currency, saveCurrency, loading: settingsLoading } = useUserSettings()
  const { locale, setLocale, p, detecting } = useLocale()
  const { openQuickAdd } = useQuickAdd()
  const [open, setOpen] = React.useState(false)
  const [intent, setIntent] = React.useState<OnboardingIntent>('solo')

  React.useEffect(() => {
    if (!uid || loading || settingsLoading || detecting) return
    if (readOnboarding(uid, 'welcome')) return
    if (transactions.length > 0) {
      writeOnboarding(uid, 'welcome', 'existing')
      return
    }
    setOpen(true)
  }, [uid, loading, settingsLoading, detecting, transactions.length])

  const finish = (startFirstEntry: boolean) => {
    writeOnboarding(uid, 'welcome', 'done')
    writeOnboarding(uid, 'intent', intent)
    setOpen(false)
    if (startFirstEntry) openQuickAdd()
  }

  const intents: { value: OnboardingIntent; icon: typeof User; label: string; hint: string }[] = [
    {
      value: 'solo',
      icon: User,
      label: p({ th: 'จดรายรับรายจ่ายตัวเอง', en: 'Track my own money', zh: '记录个人收支' }),
      hint: p({ th: 'เร็วที่สุด เริ่มได้เลย', en: 'Fastest — start right away', zh: '最快，马上开始' }),
    },
    {
      value: 'friends',
      icon: Users,
      label: p({ th: 'หารค่าใช้จ่ายกับเพื่อน', en: 'Split costs with friends', zh: '和朋友分摊' }),
      hint: p({ th: 'จดว่าใครติดเงินใคร', en: 'See who owes whom', zh: '记录谁欠谁' }),
    },
    {
      value: 'trips',
      icon: Plane,
      label: p({ th: 'ทริปเที่ยวเป็นกลุ่ม', en: 'Group trips', zh: '团体旅行' }),
      hint: p({ th: 'รวมบิลทั้งทริปแล้วเคลียร์ทีเดียว', en: 'Pool trip bills, settle once', zh: '汇总账单一次结清' }),
    },
  ]

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : finish(false))}>
      <DialogContent className="w-[calc(100vw-1rem)] p-4 sm:max-w-[480px] sm:p-6">
        <DialogHeader>
          <DialogTitle>
            {p({ th: 'ยินดีต้อนรับ', en: 'Welcome', zh: '欢迎' })}
          </DialogTitle>
          <DialogDescription>
            {p({
              th: 'ตั้งค่า 2 อย่างแล้วเริ่มจดได้เลย เปลี่ยนทีหลังได้ในตั้งค่า',
              en: 'Two quick choices, then start logging. You can change these later in Settings.',
              zh: '两个选项后即可开始记录，之后可在设置中修改',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium" id="welcome-language">
                {p({ th: 'ภาษา', en: 'Language', zh: '语言' })}
              </p>
              <div className="flex gap-1.5" role="group" aria-labelledby="welcome-language">
                {LANGUAGES.map((lang) => (
                  <Button
                    key={lang.value}
                    type="button"
                    variant={locale === lang.value ? 'default' : 'outline'}
                    className="h-10 flex-1 px-2"
                    aria-pressed={locale === lang.value}
                    onClick={() => void setLocale(lang.value)}
                  >
                    {lang.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome-currency">
                {p({ th: 'สกุลเงินหลัก', en: 'Main currency', zh: '主要货币' })}
              </Label>
              <CurrencySelect
                id="welcome-currency"
                value={currency}
                onChange={(next) => void saveCurrency(next)}
                className="h-10 w-full"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium" id="welcome-intent">
              {p({ th: 'จะใช้ทำอะไรเป็นหลัก', en: 'What will you mostly use it for?', zh: '主要用途' })}
            </p>
            <div className="grid gap-2" role="group" aria-labelledby="welcome-intent">
              {intents.map(({ value, icon: Icon, label, hint }) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={intent === value}
                  onClick={() => setIntent(value)}
                  className={cn(
                    'flex min-h-12 items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    intent === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted/50'
                  )}
                >
                  <Icon
                    className={cn('size-5 shrink-0', intent === value ? 'text-primary' : 'text-muted-foreground')}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-xs text-muted-foreground">{hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" className="h-10" onClick={() => finish(false)}>
            {p({ th: 'ข้ามไปก่อน', en: 'Skip for now', zh: '暂时跳过' })}
          </Button>
          <Button type="button" className="h-10" onClick={() => finish(true)}>
            {p({ th: 'จดรายการแรก', en: 'Log my first entry', zh: '记录第一笔' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
