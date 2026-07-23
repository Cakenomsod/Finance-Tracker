'use client'

import * as React from 'react'
import {
  Bell,
  Palette,
  Shield,
  Download,
  Trash2,
  ChevronRight,
  Sparkles,
  MessageCircle,
  Moon,
  Sun,
  Check,
  Monitor,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { useUserSettings } from '@/hooks/use-user-settings'
import { useLocale } from '@/components/locale-provider'
import { ProfileSettings } from '@/components/settings/profile-settings'
import { CategoriesSettings } from '@/components/settings/categories-settings'
import { RecurringExpensesSettings } from '@/components/settings/recurring-expenses-settings'
import { toast } from 'sonner'

import { auth } from '@/lib/firebase'

const notificationSettings = [
  { id: 'daily_summary', title: 'Daily Summary', description: 'Receive daily spending summary', enabled: true },
  { id: 'budget_alert', title: 'Budget Alerts', description: 'Alert when nearing budget limits', enabled: true },
  { id: 'unusual_activity', title: 'Unusual Activity', description: 'Alert for unusual spending patterns', enabled: true },
  { id: 'debt_reminder', title: 'Debt Reminders', description: 'Remind about pending debts', enabled: true },
]

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const {
    immich,
    aiInsightsWeekly,
    aiInsightsMonthly,
    saveAiInsightsSettings,
  } = useUserSettings()
  const { t } = useLocale()
  const [mounted, setMounted] = React.useState(false)
  const [notifications, setNotifications] = React.useState(notificationSettings)
  const [savingInsights, setSavingInsights] = React.useState<'weekly' | 'monthly' | null>(null)
  const [testingImmich, setTestingImmich] = React.useState(false)
  const [testingLocalAi, setTestingLocalAi] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  const activeTheme = mounted ? theme : undefined

  const toggleNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    )
  }

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
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('ไม่พบข้อมูลการล็อกอิน กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง');
      }
      
      const token = await currentUser.getIdToken(true); 

      const res = await fetch('/api/immich/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ baseUrl: immich?.baseUrl, apiKey: immich?.apiKey }),
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Connection failed')
      toast.success('เชื่อมต่อ Immich สำเร็จ')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ')
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
      toast.success('เชื่อมต่อ Local AI สำเร็จ')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'เชื่อมต่อไม่สำเร็จ')
    } finally {
      setTestingLocalAi(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      <ProfileSettings />
      <CategoriesSettings />
      <RecurringExpensesSettings />

      {/* Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure how you receive alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly AI Insights</p>
              <p className="text-sm text-muted-foreground">
                Auto-generate a weekly spending report each Monday
              </p>
            </div>
            <Switch
              checked={aiInsightsWeekly}
              disabled={savingInsights === 'weekly'}
              onCheckedChange={(checked) =>
                handleAiInsightsToggle('aiInsightsWeekly', checked)
              }
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Monthly AI Insights</p>
              <p className="text-sm text-muted-foreground">
                Auto-generate a monthly spending report on the 1st
              </p>
            </div>
            <Switch
              checked={aiInsightsMonthly}
              disabled={savingInsights === 'monthly'}
              onCheckedChange={(checked) =>
                handleAiInsightsToggle('aiInsightsMonthly', checked)
              }
            />
          </div>
          <Separator />
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className="flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-muted-foreground">{notification.description}</p>
              </div>
              <Switch
                checked={notification.enabled}
                onCheckedChange={() => toggleNotification(notification.id)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* AI Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5" />
            AI Preferences
          </CardTitle>
          <CardDescription>ทดสอบการเชื่อมต่อ AI Services</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleTestImmich} disabled={testingImmich}>
              {testingImmich ? 'ทดสอบ...' : 'ทดสอบ Immich'}
            </Button>
            <Button type="button" variant="outline" onClick={handleTestLocalAi} disabled={testingLocalAi}>
              {testingLocalAi ? 'ทดสอบ...' : 'ทดสอบ Local AI'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* LINE Integration Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="size-5" />
            LINE Integration
          </CardTitle>
          <CardDescription>Manage LINE bot connection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg bg-primary/10 p-4">
              <div className="flex items-center gap-3">
                <Check className="size-5 text-primary" />
                <div>
                  <p className="font-medium">LINE Bot Connected</p>
                  <p className="text-sm text-muted-foreground">Core Finance Bot</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Disconnect
              </Button>
            </div>
            <div className="grid gap-2">
              <Label>Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value="https://api.corefinance.app/webhook/line"
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize the look and feel</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  {activeTheme === 'system' && resolvedTheme
                    ? `Following system (${resolvedTheme} mode)`
                    : 'Select your preferred theme'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant={activeTheme === 'dark' ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn('gap-2', activeTheme === 'dark' && 'border-primary')}
                  onClick={() => setTheme('dark')}
                  disabled={!mounted}
                >
                  <Moon className="size-4" />
                  Dark
                </Button>
                <Button
                  variant={activeTheme === 'light' ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn('gap-2', activeTheme === 'light' && 'border-primary')}
                  onClick={() => setTheme('light')}
                  disabled={!mounted}
                >
                  <Sun className="size-4" />
                  Light
                </Button>
                <Button
                  variant={activeTheme === 'system' ? 'outline' : 'ghost'}
                  size="sm"
                  className={cn('gap-2', activeTheme === 'system' && 'border-primary')}
                  onClick={() => setTheme('system')}
                  disabled={!mounted}
                  title="Sync with device theme"
                >
                  <Monitor className="size-4" />
                  Sync
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Compact Mode</p>
                <p className="text-sm text-muted-foreground">Reduce spacing in the interface</p>
              </div>
              <Switch />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data & Privacy */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-5" />
            Data & Privacy
          </CardTitle>
          <CardDescription>Manage your data and privacy settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Export Data</p>
              <p className="text-sm text-muted-foreground">Download all your financial data</p>
            </div>
            <Button variant="outline" className="gap-2">
              <Download className="size-4" />
              Export
            </Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-destructive">Delete Account</p>
              <p className="text-sm text-muted-foreground">Permanently delete your account and data</p>
            </div>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="size-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
