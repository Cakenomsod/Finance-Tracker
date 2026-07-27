'use client'

import * as React from 'react'
import Link from 'next/link'
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
import { useLocale } from '@/components/locale-provider'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { CategoriesSettings } from '@/components/settings/categories-settings'
import { RecurringExpensesSettings } from '@/components/settings/recurring-expenses-settings'
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
  const { theme, setTheme, resolvedTheme } = useTheme()
  const {
    aiInsightsWeekly,
    aiInsightsMonthly,
    saveAiInsightsSettings,
  } = useUserSettings()
  const {
    configured: immichConfigured,
    host: immichHost,
    loading: immichStatusLoading,
    refresh: refreshImmichStatus,
  } = useImmichStatus()
  const { t } = useLocale()
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
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSavingInsights(null)
    }
  }

  const handleTestImmich = async () => {
    setTestingImmich(true)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        throw new Error('ไม่พบข้อมูลการล็อกอิน กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง')
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
      if (!res.ok) throw new Error(data.error || 'Connection failed')
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
      if (!res.ok) throw new Error(data.error || data.message || 'Connection failed')
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

      <Tabs defaultValue="account" className="gap-6">
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
                      ? t('settings.themeSystem', { mode: resolvedTheme })
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
                {immichStatusLoading
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
                  disabled={testingImmich || immichStatusLoading}
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
                <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
                  <Link href="/line">
                    {t('settings.lineManage')}
                    <ChevronRight className="size-4" aria-hidden />
                  </Link>
                </Button>
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
