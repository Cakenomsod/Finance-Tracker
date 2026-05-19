'use client'

import * as React from 'react'
import {
  Settings,
  User,
  CreditCard,
  Bell,
  Palette,
  Shield,
  Download,
  Trash2,
  ChevronRight,
  Plus,
  Edit2,
  Sparkles,
  MessageCircle,
  Globe,
  Moon,
  Sun,
  Check,
  Monitor,
  ImageIcon,
  Loader2,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTheme } from 'next-themes'
import { useUserSettings } from '@/hooks/use-user-settings'
import { AiTextProvider } from '@/lib/firestore-types'
import { toast } from 'sonner'

import { auth } from '@/lib/firebase'; // 🔑 เพิ่มบรรทัดนี้ที่บนสุดของไฟล์

// Mock data
const categories = [
  { id: '1', name: 'Food & Dining', icon: '🍜', color: '#10B981', budget: 15000 },
  { id: '2', name: 'Transport', icon: '🚇', color: '#F59E0B', budget: 5000 },
  { id: '3', name: 'Shopping', icon: '🛍️', color: '#EF4444', budget: 8000 },
  { id: '4', name: 'Entertainment', icon: '🎬', color: '#8B5CF6', budget: 5000 },
  { id: '5', name: 'Bills & Utilities', icon: '📄', color: '#3B82F6', budget: 7000 },
  { id: '6', name: 'Health & Fitness', icon: '💪', color: '#EC4899', budget: 3000 },
]

const recurringExpenses = [
  { id: '1', name: 'Netflix', amount: 419, frequency: 'Monthly', nextDate: '2024-07-01' },
  { id: '2', name: 'Spotify', amount: 149, frequency: 'Monthly', nextDate: '2024-07-05' },
  { id: '3', name: 'Gym Membership', amount: 1200, frequency: 'Monthly', nextDate: '2024-07-10' },
  { id: '4', name: 'Internet', amount: 599, frequency: 'Monthly', nextDate: '2024-07-15' },
]

const notificationSettings = [
  { id: 'daily_summary', title: 'Daily Summary', description: 'Receive daily spending summary', enabled: true },
  { id: 'budget_alert', title: 'Budget Alerts', description: 'Alert when nearing budget limits', enabled: true },
  { id: 'unusual_activity', title: 'Unusual Activity', description: 'Alert for unusual spending patterns', enabled: true },
  { id: 'weekly_report', title: 'Weekly Reports', description: 'Detailed weekly analysis', enabled: false },
  { id: 'debt_reminder', title: 'Debt Reminders', description: 'Remind about pending debts', enabled: true },
]

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const { immich, aiTextProvider, localAiBaseUrl, saveImmichSettings, saveAiSettings, loading: settingsLoading } = useUserSettings()
  const [mounted, setMounted] = React.useState(false)
  const [notifications, setNotifications] = React.useState(notificationSettings)
  const [immichBaseUrl, setImmichBaseUrl] = React.useState('')
  const [immichApiKey, setImmichApiKey] = React.useState('')
  const [textProvider, setTextProvider] = React.useState<AiTextProvider>('gemma')
  const [localAiUrl, setLocalAiUrl] = React.useState('')
  const [testingImmich, setTestingImmich] = React.useState(false)
  const [testingLocalAi, setTestingLocalAi] = React.useState(false)
  const [savingImmich, setSavingImmich] = React.useState(false)
  const [savingAi, setSavingAi] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (immich?.baseUrl) setImmichBaseUrl(immich.baseUrl)
    if (immich?.apiKey) setImmichApiKey(immich.apiKey)
  }, [immich?.baseUrl, immich?.apiKey])

  React.useEffect(() => {
    setTextProvider(aiTextProvider)
    setLocalAiUrl(localAiBaseUrl || '')
  }, [aiTextProvider, localAiBaseUrl])

  const activeTheme = mounted ? theme : undefined

  const toggleNotification = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, enabled: !n.enabled } : n))
    )
  }

  const handleTestImmich = async () => {
    setTestingImmich(true)
    try {
      // 🔑 1. ดึงตัวแปร auth ของหน้าบ้านมาแกะรหัส Token ล่าสุดแบบสดๆ ร้อนๆ
      // (มั่นใจว่าด้านบนสุดของไฟล์มีการ import auth จาก lib/firebase ของคุณแล้วนะครับ)
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('ไม่พบข้อมูลการล็อกอิน กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง');
      }
      
      // สั่งรีเฟรช token ใหม่เพื่อความชัวร์ว่าไม่หมดอายุ
      const token = await currentUser.getIdToken(true); 

      // 2. ส่งคำขอ fetch ไปที่ API
      const res = await fetch('/api/immich/test', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          // 🔑 3. แปะป้าย Authorization ส่งเป็น Bearer Token ไปแทนคุกกี้
          'Authorization': `Bearer ${token}` 
        },
        // เอา credentials: 'include' ของเก่าออกได้เลยครับ
        body: JSON.stringify({ baseUrl: immichBaseUrl, apiKey: immichApiKey }),
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

  const handleSaveImmich = async () => {
    setSavingImmich(true)
    try {
      await saveImmichSettings({ baseUrl: immichBaseUrl, apiKey: immichApiKey })
      toast.success('บันทึกการตั้งค่า Immich แล้ว')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSavingImmich(false)
    }
  }

  const handleSaveAi = async () => {
    setSavingAi(true)
    try {
      await saveAiSettings(textProvider, localAiUrl || undefined)
      toast.success('บันทึกการตั้งค่า AI แล้ว')
    } catch {
      toast.error('บันทึกไม่สำเร็จ')
    } finally {
      setSavingAi(false)
    }
  }

  const handleTestLocalAi = async () => {
    if (!localAiUrl.trim()) {
      toast.error('กรุณาใส่ Local AI URL')
      return
    }
    setTestingLocalAi(true)
    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: localAiUrl }),
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
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account and app preferences.
        </p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5" />
            Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/20 text-primary text-xl">
                JD
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-lg font-semibold">John Doe</h3>
              <p className="text-sm text-muted-foreground">john@example.com</p>
            </div>
            <Button variant="outline">Edit Profile</Button>
          </div>
          <Separator className="my-6" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="currency">Currency</Label>
              <Select defaultValue="thb">
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="thb">Thai Baht (฿)</SelectItem>
                  <SelectItem value="usd">US Dollar ($)</SelectItem>
                  <SelectItem value="eur">Euro (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="language">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger id="language">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="th">ไทย</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              Categories
            </CardTitle>
            <CardDescription>Manage spending categories and budgets</CardDescription>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="size-4" />
                Add Category
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Category</DialogTitle>
                <DialogDescription>Create a new spending category</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label>Category Name</Label>
                  <Input placeholder="e.g., Groceries" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Icon</Label>
                    <Input placeholder="🛒" />
                  </div>
                  <div className="grid gap-2">
                    <Label>Monthly Budget (฿)</Label>
                    <Input type="number" placeholder="5000" />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button>Save Category</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {categories.map((category) => (
              <div
                key={category.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex size-10 items-center justify-center rounded-lg text-lg"
                    style={{ backgroundColor: `${category.color}20` }}
                  >
                    {category.icon}
                  </div>
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Budget: ฿{category.budget.toLocaleString()}/month
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon">
                    <Edit2 className="size-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive">
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recurring Expenses */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="size-5" />
              Recurring Expenses
            </CardTitle>
            <CardDescription>Track subscriptions and regular payments</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="gap-2">
            <Plus className="size-4" />
            Add Recurring
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recurringExpenses.map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <p className="font-medium">{expense.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline" className="text-xs">
                      {expense.frequency}
                    </Badge>
                    <span>Next: {new Date(expense.nextDate).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-semibold tabular-nums">
                    ฿{expense.amount.toLocaleString()}
                  </span>
                  <Button variant="ghost" size="icon">
                    <Edit2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
          <CardDescription>Immich สำหรับรูปถาวร + เลือก AI สำหรับข้อความ</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">เมื่อ restart tunnel แล้วลิงก์เปลี่ยน ให้อัปเดต Base URL ที่นี่</p>
          <div className="space-y-2">
            <Label htmlFor="immich-url">Immich Base URL</Label>
            <Input id="immich-url" placeholder="https://xxxx.trycloudflare.com" value={immichBaseUrl} onChange={(e) => setImmichBaseUrl(e.target.value)} disabled={settingsLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="immich-key">API Key</Label>
            <Input id="immich-key" type="password" value={immichApiKey} onChange={(e) => setImmichApiKey(e.target.value)} disabled={settingsLoading} />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleTestImmich} disabled={testingImmich}>ทดสอบ Immich</Button>
            <Button type="button" onClick={handleSaveImmich} disabled={savingImmich}>บันทึก Immich</Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>Text AI Provider</Label>
            <Select value={textProvider} onValueChange={(v) => setTextProvider(v as AiTextProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gemma">Gemma API</SelectItem>
                <SelectItem value="local">Local AI</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {textProvider === 'local' && (
            <div className="space-y-2">
              <Label>Local AI URL</Label>
              <Input value={localAiUrl} onChange={(e) => setLocalAiUrl(e.target.value)} placeholder="http://192.168.1.x:11434" />
              <Button type="button" variant="outline" size="sm" onClick={handleTestLocalAi} disabled={testingLocalAi || !localAiUrl.trim()}>
                {testingLocalAi ? 'ทดสอบ...' : 'ทดสอบ Local AI'}
              </Button>
            </div>
          )}
          <Badge variant="secondary" className="text-xs">
            รูปใบเสร็จ: Gemini · แชทข้อความ: {textProvider === 'local' ? 'Local AI' : 'Gemma API'}
          </Badge>
          <Button type="button" onClick={handleSaveAi} disabled={savingAi}>บันทึก AI</Button>
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
