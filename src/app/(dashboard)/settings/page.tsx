'use client'

import * as React from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import {
  Bell,
  Palette,
  Shield,
  Download,
  Trash2,
  Sparkles,
  MessageCircle,
  Moon,
  Sun,
  Monitor,
  ChevronRight,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useImmichStatus } from '@/hooks/use-immich-status'
import { IMMICH_ENABLED, IMMICH_MAINTENANCE_MESSAGE } from '@/lib/immich/feature'
import { useLocale } from '@/components/locale-provider'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { CategoriesSettings } from '@/components/settings/categories-settings'
import { RecurringExpensesSettings } from '@/components/settings/recurring-expenses-settings'
import { PaymentSourcesSettings } from '@/components/settings/payment-sources-settings'
import { MoneyPoolsSettings } from '@/components/settings/money-pools-settings'
import { toast } from 'sonner'

import { auth } from '@/lib/firebase'

function SettingToggleRow({
  id,
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
}: {
  id: string
  title: string
  description: string
  checked: boolean
  disabled?: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={id} className="text-sm font-medium leading-none cursor-pointer">
          {title}
        </Label>
        <p id={`${id}-desc`} className="text-sm text-muted-foreground text-pretty max-w-prose">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
        aria-describedby={`${id}-desc`}
        className="mt-0.5 shrink-0"
      />
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
          <div className="h-8 w-40 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-full max-w-md animate-pulse rounded-md bg-muted" />
          <div className="h-48 w-full animate-pulse rounded-xl bg-muted" />
        </div>
      }
    >
      <SettingsPageInner />
    </Suspense>
  )
}

function SettingsPageInner() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const searchParams = useSearchParams()
  const tabParam = searchParams.get('tab')
  const initialTab =
    tabParam === 'money' || tabParam === 'preferences' || tabParam === 'data' || tabParam === 'account'
      ? tabParam
      : 'account'
  const {
    profile,
    aiInsightsWeekly,
    aiInsightsMonthly,
    saveAiInsightsSettings,
  } = useUserSettings()
  const lineLinked = Boolean(profile?.lineUserId)
  // Connection tests are for whoever runs the server, not everyday users.
  const showDiagnostics =
    process.env.NEXT_PUBLIC_SHOW_DIAGNOSTICS === '1' || searchParams.get('debug') === '1'
  const {
    configured: immichConfigured,
    host: immichHost,
    loading: immichStatusLoading,
    refresh: refreshImmichStatus,
  } = useImmichStatus()
  const { t, p } = useLocale()
  const [mounted, setMounted] = React.useState(false)
  const [savingInsights, setSavingInsights] = React.useState<'weekly' | 'monthly' | null>(null)
  const [testingImmich, setTestingImmich] = React.useState(false)
  const [testingLocalAi, setTestingLocalAi] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? theme : undefined

  const handleAiInsightsToggle = async (
    field: 'aiInsightsWeekly' | 'aiInsightsMonthly',
    enabled: boolean
  ) => {
    setSavingInsights(field === 'aiInsightsWeekly' ? 'weekly' : 'monthly')
    try {
      await saveAiInsightsSettings({ [field]: enabled })
      toast.success(t('settings.saved'))
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : p({ th: 'บันทึกไม่สำเร็จ', en: 'Failed to save', zh: '保存失败' })
      )
    } finally {
      setSavingInsights(null)
    }
  }

  const handleTestImmich = async () => {
    setTestingImmich(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error(
          p({
            th: 'ไม่พบข้อมูลการล็อกอิน กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง',
            en: 'Sign-in session not found. Please sign in again.',
            zh: '未找到登录信息，请重新登录。',
          })
        )
      }

      const token = await currentUser.getIdToken(true)

      // Server reads Photo tunnel_config + IMMICH_API_KEY (not profile.immich)
      const res = await fetch('/api/immich/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || t('settings.immichFailed'))
      toast.success(t('settings.immichConnected'))
      await refreshImmichStatus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.immichFailed'))
    } finally {
      setTestingImmich(false)
    }
  }

  const handleTestLocalAi = async () => {
    setTestingLocalAi(true)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message || t('settings.localAiFailed'))
      toast.success(t('settings.localAiConnected'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('settings.localAiFailed'))
    } finally {
      setTestingLocalAi(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto w-full">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {t('settings.title')}
        </h1>
        <p className="text-sm text-muted-foreground text-pretty max-w-prose">
          {t('settings.subtitle')}
        </p>
      </header>

      <Tabs defaultValue={initialTab} className="gap-6">
        <TabsList
          className="h-auto w-full flex-wrap justify-start gap-1 bg-muted p-1 sm:w-fit"
          aria-label={t('settings.title')}
        >
          <TabsTrigger
            value="account"
            className="flex-none px-3 transition-[color,box-shadow] duration-200 motion-reduce:transition-none"
          >
            {t('settings.tab.account')}
          </TabsTrigger>
          <TabsTrigger
            value="money"
            className="flex-none px-3 transition-[color,box-shadow] duration-200 motion-reduce:transition-none"
          >
            {t('settings.tab.money')}
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="flex-none px-3 transition-[color,box-shadow] duration-200 motion-reduce:transition-none"
          >
            {t('settings.tab.preferences')}
          </TabsTrigger>
          <TabsTrigger
            value="data"
            className="flex-none px-3 transition-[color,box-shadow] duration-200 motion-reduce:transition-none"
          >
            {t('settings.tab.data')}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="account"
          className="mt-0 space-y-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <ProfileSettings />
        </TabsContent>

        <TabsContent
          value="money"
          className="mt-0 space-y-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <CategoriesSettings />
          <PaymentSourcesSettings />
          <MoneyPoolsSettings />
          <RecurringExpensesSettings />
        </TabsContent>

        <TabsContent
          value="preferences"
          className="mt-0 space-y-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <Bell className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('settings.notifications')}
              </CardTitle>
              <CardDescription>{t('settings.notificationsDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SettingToggleRow
                id="ai-insights-weekly"
                title={t('settings.aiInsightsWeekly')}
                description={t('settings.aiInsightsWeeklyDesc')}
                checked={aiInsightsWeekly}
                disabled={savingInsights === 'weekly'}
                onCheckedChange={(checked) =>
                  handleAiInsightsToggle('aiInsightsWeekly', checked)
                }
              />
              <Separator />
              <SettingToggleRow
                id="ai-insights-monthly"
                title={t('settings.aiInsightsMonthly')}
                description={t('settings.aiInsightsMonthlyDesc')}
                checked={aiInsightsMonthly}
                disabled={savingInsights === 'monthly'}
                onCheckedChange={(checked) =>
                  handleAiInsightsToggle('aiInsightsMonthly', checked)
                }
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <Palette className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('settings.appearance')}
              </CardTitle>
              <CardDescription>{t('settings.appearanceDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-none">{t('settings.theme')}</p>
                  <p className="text-sm text-muted-foreground text-pretty">
                    {activeTheme === 'system' && resolvedTheme
                      ? t('settings.themeSystem', {
                          mode:
                            resolvedTheme === 'dark'
                              ? t('settings.themeDark')
                              : t('settings.themeLight'),
                        })
                      : t('settings.themeDesc')}
                  </p>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="group"
                  aria-label={t('settings.theme')}
                >
                  <Button
                    type="button"
                    variant={activeTheme === 'dark' ? 'outline' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2 transition-[border-color,background-color,opacity] duration-200 motion-reduce:transition-none',
                      activeTheme === 'dark' && 'border-primary'
                    )}
                    onClick={() => setTheme('dark')}
                    disabled={!mounted}
                    aria-pressed={activeTheme === 'dark'}
                  >
                    <Moon className="size-4" aria-hidden />
                    {t('settings.themeDark')}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTheme === 'light' ? 'outline' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2 transition-[border-color,background-color,opacity] duration-200 motion-reduce:transition-none',
                      activeTheme === 'light' && 'border-primary'
                    )}
                    onClick={() => setTheme('light')}
                    disabled={!mounted}
                    aria-pressed={activeTheme === 'light'}
                  >
                    <Sun className="size-4" aria-hidden />
                    {t('settings.themeLight')}
                  </Button>
                  <Button
                    type="button"
                    variant={activeTheme === 'system' ? 'outline' : 'ghost'}
                    size="sm"
                    className={cn(
                      'gap-2 transition-[border-color,background-color,opacity] duration-200 motion-reduce:transition-none',
                      activeTheme === 'system' && 'border-primary'
                    )}
                    onClick={() => setTheme('system')}
                    disabled={!mounted}
                    aria-pressed={activeTheme === 'system'}
                    title={t('settings.themeSyncTitle')}
                  >
                    <Monitor className="size-4" aria-hidden />
                    {t('settings.themeSync')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {showDiagnostics && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <Sparkles className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('settings.aiPreferences')}
              </CardTitle>
              <CardDescription>{t('settings.aiPreferencesDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-pretty">
                {!IMMICH_ENABLED
                  ? p({
                      th: `${IMMICH_MAINTENANCE_MESSAGE} (เปิดกลับด้วย NEXT_PUBLIC_IMMICH_ENABLED=1)`,
                      en: 'Photo attachments are under maintenance (re-enable with NEXT_PUBLIC_IMMICH_ENABLED=1)',
                      zh: '照片附件功能维护中（设置 NEXT_PUBLIC_IMMICH_ENABLED=1 可重新启用）',
                    })
                  : immichStatusLoading
                  ? t('settings.immichChecking')
                  : immichConfigured
                    ? immichHost
                      ? t('settings.immichConfigured', { host: immichHost })
                      : t('settings.immichConfiguredNoHost')
                    : t('settings.immichNotConfigured')}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestImmich}
                  disabled={!IMMICH_ENABLED || testingImmich || immichStatusLoading}
                  className="transition-opacity duration-200 motion-reduce:transition-none"
                >
                  {testingImmich ? t('settings.testing') : t('settings.testImmich')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestLocalAi}
                  disabled={testingLocalAi}
                  className="transition-opacity duration-200 motion-reduce:transition-none"
                >
                  {testingLocalAi ? t('settings.testing') : t('settings.testLocalAi')}
                </Button>
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <MessageCircle className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('settings.lineIntegration')}
              </CardTitle>
              <CardDescription>{t('settings.lineIntegrationDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground text-pretty max-w-prose">
                  {t('settings.lineManageHint')}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant="secondary"
                    className={cn(lineLinked && 'bg-primary/10 text-primary')}
                  >
                    {lineLinked
                      ? p({ th: 'เชื่อมแล้ว', en: 'Connected', zh: '已连接' })
                      : p({ th: 'ยังไม่เชื่อม', en: 'Not connected', zh: '未连接' })}
                  </Badge>
                  <Button variant="outline" size="sm" className="h-9 gap-2" asChild>
                    <Link href="/line">
                      {t('settings.lineManage')}
                      <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="data"
          className="mt-0 space-y-6 animate-in fade-in-0 duration-200 motion-reduce:animate-none"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl tracking-tight">
                <Shield className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                {t('settings.dataPrivacy')}
              </CardTitle>
              <CardDescription>{t('settings.dataPrivacyDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-none">{t('settings.exportData')}</p>
                  <p className="text-sm text-muted-foreground">{t('settings.exportDataDesc')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{t('settings.comingSoon')}</Badge>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2"
                    disabled
                    aria-disabled="true"
                    title={t('settings.exportComingSoon')}
                  >
                    <Download className="size-4" aria-hidden />
                    {t('settings.export')}
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-medium leading-none text-destructive">
                    {t('settings.deleteAccount')}
                  </p>
                  <p className="text-sm text-muted-foreground">{t('settings.deleteAccountDesc')}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{t('settings.comingSoon')}</Badge>
                  <Button
                    type="button"
                    variant="destructive"
                    className="gap-2"
                    disabled
                    aria-disabled="true"
                    title={t('settings.deleteComingSoon')}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    {t('settings.delete')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
