'use client'

import * as React from 'react'
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Settings,
  Clock,
  Send,
  Terminal,
  Bot,
  Calendar,
  Bell,
  ChevronRight,
  Copy,
  ExternalLink,
  Zap,
} from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

// Mock data
const connectionStatus = {
  connected: true,
  lastSync: '2024-06-15T10:30:00',
  botName: 'Core Finance Bot',
  userId: 'U1234567890',
}

const commandExamples = [
  {
    command: 'ข้าวราดแกง 50',
    description: 'Add expense for rice curry 50 baht',
    category: 'Adding Expenses',
  },
  {
    command: 'กาแฟ 45 lunch 120',
    description: 'Add multiple items: coffee 45, lunch 120',
    category: 'Adding Expenses',
  },
  {
    command: 'ใช้ไปเท่าไหร่เดือนนี้',
    description: 'Check total spending this month',
    category: 'Queries',
  },
  {
    command: 'สรุปวันนี้',
    description: 'Get today\'s spending summary',
    category: 'Queries',
  },
  {
    command: 'เหลือเงินเท่าไหร่',
    description: 'Check remaining budget',
    category: 'Queries',
  },
  {
    command: 'ยืม 500 จากแฟน',
    description: 'Record debt: borrowed 500 from partner',
    category: 'Debts',
  },
  {
    command: 'จ่ายให้ Mike 1000',
    description: 'Record payment to Mike',
    category: 'Debts',
  },
]

const syncLogs = [
  {
    id: '1',
    type: 'expense',
    message: 'Added expense: Lunch - ฿85',
    timestamp: '2024-06-15T10:25:00',
    status: 'success',
  },
  {
    id: '2',
    type: 'query',
    message: 'Query: Monthly spending summary requested',
    timestamp: '2024-06-15T09:15:00',
    status: 'success',
  },
  {
    id: '3',
    type: 'expense',
    message: 'Added expense: Coffee - ฿65',
    timestamp: '2024-06-15T08:30:00',
    status: 'success',
  },
  {
    id: '4',
    type: 'error',
    message: 'Failed to parse: "random text"',
    timestamp: '2024-06-14T18:45:00',
    status: 'error',
  },
  {
    id: '5',
    type: 'expense',
    message: 'Added expense: Dinner - ฿320',
    timestamp: '2024-06-14T19:30:00',
    status: 'success',
  },
]

const automationSettings = [
  {
    id: 'weekly_report',
    title: 'Weekly Report',
    description: 'Send weekly spending summary every Sunday',
    enabled: true,
  },
  {
    id: 'daily_reminder',
    title: 'Daily Reminder',
    description: 'Remind to log expenses at 9 PM if none recorded',
    enabled: true,
  },
  {
    id: 'budget_alert',
    title: 'Budget Alerts',
    description: 'Alert when spending exceeds 80% of budget',
    enabled: true,
  },
  {
    id: 'monthly_summary',
    title: 'Monthly Summary',
    description: 'Send detailed monthly report on the 1st',
    enabled: false,
  },
]

export default function LinePage() {
  const [automations, setAutomations] = React.useState(automationSettings)
  const [isReconnecting, setIsReconnecting] = React.useState(false)

  const handleToggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    )
  }

  const handleReconnect = () => {
    setIsReconnecting(true)
    setTimeout(() => setIsReconnecting(false), 2000)
  }

  const groupedCommands = commandExamples.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, typeof commandExamples>)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Page Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">LINE Bot Integration</h1>
        <p className="text-muted-foreground">
          Connect and manage your LINE bot for expense tracking on-the-go.
        </p>
      </div>

      {/* Connection Status */}
      <Card
        className={cn(
          'border-2',
          connectionStatus.connected ? 'border-primary/20' : 'border-destructive/20'
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  'flex size-14 items-center justify-center rounded-xl',
                  connectionStatus.connected
                    ? 'bg-primary/20 text-primary'
                    : 'bg-destructive/20 text-destructive'
                )}
              >
                <MessageCircle className="size-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">{connectionStatus.botName}</h3>
                  <Badge
                    variant={connectionStatus.connected ? 'default' : 'destructive'}
                    className={cn(
                      connectionStatus.connected && 'bg-primary/20 text-primary'
                    )}
                  >
                    {connectionStatus.connected ? (
                      <>
                        <CheckCircle2 className="mr-1 size-3" />
                        Connected
                      </>
                    ) : (
                      <>
                        <XCircle className="mr-1 size-3" />
                        Disconnected
                      </>
                    )}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Last sync:{' '}
                  {new Date(connectionStatus.lastSync).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleReconnect} disabled={isReconnecting}>
                <RefreshCw
                  className={cn('mr-2 size-4', isReconnecting && 'animate-spin')}
                />
                Reconnect
              </Button>
              <Button variant="outline">
                <Settings className="mr-2 size-4" />
                Configure
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/20">
                <Send className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">Send Test Message</p>
                <p className="text-sm text-muted-foreground">Verify bot connection</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-chart-2/20">
                <Calendar className="size-5 text-chart-2" />
              </div>
              <div>
                <p className="font-medium">Send Weekly Report</p>
                <p className="text-sm text-muted-foreground">Trigger manual report</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-all hover:shadow-md">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-warning/20">
                <Bell className="size-5 text-warning" />
              </div>
              <div>
                <p className="font-medium">Send Reminder</p>
                <p className="text-sm text-muted-foreground">Log expense reminder</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Commands, Logs, and Automation */}
      <Tabs defaultValue="commands" className="w-full">
        <TabsList>
          <TabsTrigger value="commands" className="gap-2">
            <Terminal className="size-4" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <Clock className="size-4" />
            Sync Logs
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Zap className="size-4" />
            Automation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commands" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Supported Commands</CardTitle>
              <CardDescription>
                Send these messages to your LINE bot to track expenses
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <div key={category}>
                  <h4 className="text-sm font-medium text-muted-foreground mb-3">
                    {category}
                  </h4>
                  <div className="space-y-2">
                    {commands.map((cmd, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg border p-3"
                      >
                        <div className="flex items-center gap-3">
                          <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                            {cmd.command}
                          </code>
                          <ChevronRight className="size-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {cmd.description}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon">
                          <Copy className="size-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Messages synced from your LINE bot</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {syncLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          'flex size-8 items-center justify-center rounded-full',
                          log.status === 'success'
                            ? 'bg-primary/20 text-primary'
                            : 'bg-destructive/20 text-destructive'
                        )}
                      >
                        {log.status === 'success' ? (
                          <CheckCircle2 className="size-4" />
                        ) : (
                          <XCircle className="size-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm">{log.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={log.status === 'success' ? 'secondary' : 'destructive'}
                      className={cn(
                        'text-xs',
                        log.status === 'success' && 'bg-primary/10 text-primary'
                      )}
                    >
                      {log.type}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="automation" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Automated Messages</CardTitle>
              <CardDescription>Configure automatic reports and reminders</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {automations.map((automation) => (
                <div
                  key={automation.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={cn(
                        'flex size-10 items-center justify-center rounded-lg',
                        automation.enabled
                          ? 'bg-primary/20 text-primary'
                          : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Bot className="size-5" />
                    </div>
                    <div>
                      <p className="font-medium">{automation.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {automation.description}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={automation.enabled}
                    onCheckedChange={() => handleToggleAutomation(automation.id)}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Setup Instructions */}
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle>Need Help Setting Up?</CardTitle>
          <CardDescription>Follow these steps to connect your LINE bot</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                1
              </span>
              <span>
                Create a LINE Messaging API channel in the{' '}
                <a href="#" className="text-primary underline-offset-4 hover:underline">
                  LINE Developers Console
                </a>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                2
              </span>
              <span>Copy your Channel Access Token and Channel Secret</span>
            </li>
            <li className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                3
              </span>
              <span>Add your webhook URL to the LINE channel settings</span>
            </li>
            <li className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-medium text-primary">
                4
              </span>
              <span>Add the bot as a friend and start sending messages!</span>
            </li>
          </ol>
          <Button variant="outline" className="mt-4">
            <ExternalLink className="mr-2 size-4" />
            View Full Documentation
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
