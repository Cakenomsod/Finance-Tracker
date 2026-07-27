'use client'

import * as React from 'react'
import {
  MessageCircle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  Send,
  Terminal,
  Calendar,
  Bell,
  Copy,
  Zap,
  AlertCircle,
  MessageSquareText,
} from 'lucide-react'
import { toast } from 'sonner'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
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
    description: 'บันทึกรายจ่าย ข้าวราดแกง 50 บาท',
    category: 'บันทึกรายจ่าย',
  },
  {
    command: 'กาแฟ 45 lunch 120',
    description: 'บันทึกหลายรายการ: กาแฟ 45, lunch 120',
    category: 'บันทึกรายจ่าย',
  },
  {
    command: 'ใช้ไปเท่าไหร่เดือนนี้',
    description: 'ดูยอดใช้จ่ายเดือนนี้',
    category: 'สอบถาม',
  },
  {
    command: 'สรุปวันนี้',
    description: 'สรุปการใช้จ่ายวันนี้',
    category: 'สอบถาม',
  },
  {
    command: 'เหลือเงินเท่าไหร่',
    description: 'ดูงบคงเหลือ',
    category: 'สอบถาม',
  },
  {
    command: 'ยืม 500 จากแฟน',
    description: 'บันทึกหนี้: ยืม 500 จากแฟน',
    category: 'หนี้',
  },
  {
    command: 'จ่ายให้ Mike 1000',
    description: 'บันทึกการจ่ายให้ Mike',
    category: 'หนี้',
  },
]

const syncLogs = [
  {
    id: '1',
    type: 'expense',
    message: 'บันทึกรายจ่าย: Lunch - ฿85',
    timestamp: '2024-06-15T10:25:00',
    status: 'success',
  },
  {
    id: '2',
    type: 'query',
    message: 'สอบถาม: ขอสรุปการใช้จ่ายรายเดือน',
    timestamp: '2024-06-15T09:15:00',
    status: 'success',
  },
  {
    id: '3',
    type: 'expense',
    message: 'บันทึกรายจ่าย: Coffee - ฿65',
    timestamp: '2024-06-15T08:30:00',
    status: 'success',
  },
  {
    id: '4',
    type: 'error',
    message: 'อ่านข้อความไม่สำเร็จ: "random text"',
    timestamp: '2024-06-14T18:45:00',
    status: 'error',
  },
  {
    id: '5',
    type: 'expense',
    message: 'บันทึกรายจ่าย: Dinner - ฿320',
    timestamp: '2024-06-14T19:30:00',
    status: 'success',
  },
]

const automationSettings = [
  {
    id: 'weekly_report',
    title: 'สรุปรายสัปดาห์',
    description: 'ส่งสรุปการใช้จ่ายทุกวันอาทิตย์',
    enabled: true,
  },
  {
    id: 'daily_reminder',
    title: 'เตือนรายวัน',
    description: 'เตือนบันทึกรายจ่ายเวลา 21:00 หากยังไม่มีรายการ',
    enabled: true,
  },
  {
    id: 'budget_alert',
    title: 'แจ้งเตือนงบ',
    description: 'แจ้งเมื่อใช้จ่ายเกิน 80% ของงบ',
    enabled: true,
  },
  {
    id: 'monthly_summary',
    title: 'สรุปรายเดือน',
    description: 'ส่งรายงานรายเดือนวันที่ 1 ของทุกเดือน',
    enabled: false,
  },
]

const logTypeLabel: Record<string, string> = {
  expense: 'รายจ่าย',
  query: 'สอบถาม',
  error: 'ข้อผิดพลาด',
}

function formatSyncTime(iso: string) {
  return new Date(iso).toLocaleString('th-TH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function LinePage() {
  const [automations, setAutomations] = React.useState(automationSettings)
  const [isReconnecting, setIsReconnecting] = React.useState(false)
  const [copiedCommand, setCopiedCommand] = React.useState<string | null>(null)

  const isConnected = connectionStatus.connected
  const hasLogs = syncLogs.length > 0

  const handleToggleAutomation = (id: string) => {
    setAutomations((prev) =>
      prev.map((a) => (a.id === id ? { ...a, enabled: !a.enabled } : a))
    )
  }

  const handleReconnect = () => {
    setIsReconnecting(true)
    setTimeout(() => setIsReconnecting(false), 2000)
  }

  const handleCopyCommand = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command)
      setCopiedCommand(command)
      toast.success('คัดลอกคำสั่งแล้ว')
      window.setTimeout(() => setCopiedCommand(null), 1500)
    } catch {
      toast.error('คัดลอกคำสั่งไม่สำเร็จ')
    }
  }

  const groupedCommands = commandExamples.reduce(
    (acc, cmd) => {
      if (!acc[cmd.category]) acc[cmd.category] = []
      acc[cmd.category].push(cmd)
      return acc
    },
    {} as Record<string, typeof commandExamples>
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">LINE Bot</h1>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty sm:text-base">
          บันทึกรายจ่ายผ่านแชท LINE ได้เร็วกว่าลืม — เชื่อมต่อครั้งเดียว แล้วพิมพ์หาบอทได้ทุกเมื่อ
        </p>
      </header>

      {!isConnected && (
        <Alert variant="destructive">
          <AlertCircle aria-hidden />
          <AlertTitle>ยังไม่ได้เชื่อมต่อ LINE</AlertTitle>
          <AlertDescription>
            ข้อความจะยังไม่ซิงก์จนกว่าจะเชื่อมต่อสำเร็จ หากเชื่อมไว้แล้ว ลองกดเชื่อมต่ออีกครั้งด้านล่าง
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div
                  className={cn(
                    'flex size-11 shrink-0 items-center justify-center rounded-lg sm:size-12',
                    isConnected ? 'bg-muted text-foreground' : 'bg-destructive/10 text-destructive'
                  )}
                  aria-hidden
                >
                  <MessageCircle className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold tracking-tight text-balance">
                      {connectionStatus.botName}
                    </h2>
                    <Badge
                      variant={isConnected ? 'default' : 'destructive'}
                      className="gap-1"
                      aria-live="polite"
                    >
                      {isConnected ? (
                        <>
                          <CheckCircle2 className="size-3" aria-hidden />
                          เชื่อมต่อแล้ว
                        </>
                      ) : (
                        <>
                          <XCircle className="size-3" aria-hidden />
                          ยังไม่เชื่อมต่อ
                        </>
                      )}
                    </Badge>
                  </div>
                  <dl className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-[auto_1fr] sm:gap-x-3">
                    <dt className="font-medium text-foreground/80">ซิงกล่าสุด</dt>
                    <dd>
                      <time dateTime={connectionStatus.lastSync}>
                        {formatSyncTime(connectionStatus.lastSync)}
                      </time>
                    </dd>
                    <dt className="font-medium text-foreground/80">บัญชี LINE</dt>
                    <dd className="truncate font-mono text-xs sm:text-sm" title={connectionStatus.userId}>
                      {connectionStatus.userId}
                    </dd>
                  </dl>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 sm:shrink-0">
                <Button
                  variant={isConnected ? 'outline' : 'default'}
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  aria-busy={isReconnecting}
                >
                  <RefreshCw
                    className={cn(
                      'size-4',
                      isReconnecting && 'motion-safe:animate-spin motion-reduce:animate-none'
                    )}
                    aria-hidden
                  />
                  {isReconnecting
                    ? 'กำลังเชื่อมต่อ…'
                    : isConnected
                      ? 'เชื่อมต่ออีกครั้ง'
                      : 'เชื่อมต่อ LINE'}
                </Button>
              </div>
            </div>

            <Separator />

            <div
              className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
              role="group"
              aria-label="ทางลัด"
            >
              <Button
                variant="outline"
                className="h-10 justify-start gap-2 sm:h-9 sm:flex-1"
                disabled={!isConnected}
              >
                <Send className="size-4 shrink-0" aria-hidden />
                ส่งข้อความทดสอบ
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start gap-2 sm:h-9 sm:flex-1"
                disabled={!isConnected}
              >
                <Calendar className="size-4 shrink-0" aria-hidden />
                ส่งสรุปรายสัปดาห์
              </Button>
              <Button
                variant="outline"
                className="h-10 justify-start gap-2 sm:h-9 sm:flex-1"
                disabled={!isConnected}
              >
                <Bell className="size-4 shrink-0" aria-hidden />
                ส่งการเตือน
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="commands" className="w-full gap-4">
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="h-auto min-h-9 w-full min-w-max justify-start sm:w-fit">
            <TabsTrigger value="commands" className="min-h-9 gap-2 px-3">
              <Terminal className="size-4" aria-hidden />
              คำสั่ง
            </TabsTrigger>
            <TabsTrigger value="logs" className="min-h-9 gap-2 px-3">
              <Clock className="size-4" aria-hidden />
              บันทึกซิงก์
            </TabsTrigger>
            <TabsTrigger value="automation" className="min-h-9 gap-2 px-3">
              <Zap className="size-4" aria-hidden />
              อัตโนมัติ
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="commands"
          className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card>
            <CardHeader>
              <CardTitle>คำสั่งที่ใช้ได้</CardTitle>
              <CardDescription className="max-w-prose text-pretty">
                พิมพ์ข้อความเหล่านี้ในแชท LINE กับบอท เพื่อบันทึกรายจ่าย ดูยอด หรือบันทึกหนี้
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(groupedCommands).map(([category, commands]) => (
                <section key={category} aria-labelledby={`cmd-${category}`}>
                  <h3
                    id={`cmd-${category}`}
                    className="mb-3 text-sm font-semibold text-foreground"
                  >
                    {category}
                  </h3>
                  <ul className="divide-y rounded-lg border">
                    {commands.map((cmd) => {
                      const isCopied = copiedCommand === cmd.command
                      return (
                        <li
                          key={cmd.command}
                          className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
                        >
                          <div className="min-w-0 space-y-1">
                            <code className="inline-block max-w-full truncate rounded-md bg-muted px-2 py-1 font-mono text-sm">
                              {cmd.command}
                            </code>
                            <p className="text-sm text-muted-foreground text-pretty">
                              {cmd.description}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className={cn(
                              'size-10 shrink-0 self-end sm:size-9 sm:self-center',
                              'motion-safe:transition-colors motion-safe:duration-200'
                            )}
                            onClick={() => handleCopyCommand(cmd.command)}
                            aria-label={
                              isCopied
                                ? `คัดลอกแล้ว “${cmd.command}”`
                                : `คัดลอกคำสั่ง “${cmd.command}”`
                            }
                          >
                            {isCopied ? (
                              <CheckCircle2 className="size-4 text-primary" aria-hidden />
                            ) : (
                              <Copy className="size-4" aria-hidden />
                            )}
                          </Button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="logs"
          className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card>
            <CardHeader>
              <CardTitle>กิจกรรมล่าสุด</CardTitle>
              <CardDescription>ข้อความที่ซิงก์มาจากบอท LINE</CardDescription>
            </CardHeader>
            <CardContent>
              {!hasLogs ? (
                <Empty className="border-0 p-6 md:p-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <Clock aria-hidden />
                    </EmptyMedia>
                    <EmptyTitle>ยังไม่มีกิจกรรมซิงก์</EmptyTitle>
                    <EmptyDescription>
                      ส่งคำสั่งใน LINE เช่น{' '}
                      <span className="font-mono text-foreground">ข้าวราดแกง 50</span>{' '}
                      แล้วรายการจะแสดงที่นี่
                    </EmptyDescription>
                  </EmptyHeader>
                  <EmptyContent>
                    <p className="text-muted-foreground">
                      หรือกด “ส่งข้อความทดสอบ” ด้านบนเพื่อตรวจการเชื่อมต่อ
                    </p>
                  </EmptyContent>
                </Empty>
              ) : (
                <ul className="divide-y" role="list">
                  {syncLogs.map((log) => {
                    const isError = log.status === 'error'
                    return (
                      <li
                        key={log.id}
                        className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={cn(
                              'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md',
                              isError
                                ? 'bg-destructive/10 text-destructive'
                                : 'bg-muted text-muted-foreground'
                            )}
                            aria-hidden
                          >
                            {isError ? (
                              <XCircle className="size-4" />
                            ) : (
                              <CheckCircle2 className="size-4" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-pretty">{log.message}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              <time dateTime={log.timestamp}>{formatSyncTime(log.timestamp)}</time>
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={isError ? 'destructive' : 'secondary'}
                          className="w-fit shrink-0 self-start sm:self-center"
                        >
                          {logTypeLabel[log.type] ?? log.type}
                        </Badge>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="automation"
          className="animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card>
            <CardHeader>
              <CardTitle>ข้อความอัตโนมัติ</CardTitle>
              <CardDescription className="max-w-prose text-pretty">
                รายงานและการเตือนที่บอทส่งผ่าน LINE ให้บันทึกเป็นนิสัยโดยอัตโนมัติ
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-1">
              {automations.map((automation, index) => (
                <React.Fragment key={automation.id}>
                  {index > 0 && <Separator />}
                  <div className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="min-w-0 space-y-0.5">
                      <Label
                        htmlFor={`automation-${automation.id}`}
                        className="cursor-pointer text-sm font-medium leading-none"
                      >
                        {automation.title}
                      </Label>
                      <p
                        id={`automation-${automation.id}-desc`}
                        className="text-sm text-muted-foreground text-pretty"
                      >
                        {automation.description}
                      </p>
                    </div>
                    <Switch
                      id={`automation-${automation.id}`}
                      checked={automation.enabled}
                      onCheckedChange={() => handleToggleAutomation(automation.id)}
                      aria-describedby={`automation-${automation.id}-desc`}
                      className="mt-0.5"
                    />
                  </div>
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                isConnected ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
              )}
              aria-hidden
            >
              <MessageSquareText className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-balance">
                {isConnected ? 'วิธีใช้บอทในแชท' : 'เชื่อมต่อ LINE'}
              </CardTitle>
              <CardDescription className="max-w-prose text-pretty">
                {isConnected
                  ? 'เปิดแชทกับบอทใน LINE แล้วพิมพ์รายจ่ายหรือคำสั่งจากแท็บคำสั่ง — เช่น “กาแฟ 45” — ระบบจะบันทึกให้อัตโนมัติ'
                  : 'ยังไม่พร้อมเชื่อมต่อด้วยตัวเองในตอนนี้ — ติดต่อแอดมินเพื่อเปิดใช้งาน หรือรอฟีเจอร์ “เชื่อมต่อ LINE” เร็วๆ นี้'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        {isConnected ? (
          <CardContent>
            <ol className="space-y-3 text-sm">
              {[
                'เปิดแอป LINE แล้วเข้าแชทกับบอทที่เชื่อมไว้',
                'พิมพ์รายจ่ายสั้นๆ เช่น “ข้าวราดแกง 50” หรือดูตัวอย่างในแท็บคำสั่ง',
                'ตรวจผลในแท็บบันทึกซิงก์ หรือในรายการธุรกรรมของแอป',
              ].map((step, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium tabular-nums text-foreground"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <span className="pt-0.5 text-muted-foreground text-pretty">{step}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        ) : null}
      </Card>
    </div>
  )
}
