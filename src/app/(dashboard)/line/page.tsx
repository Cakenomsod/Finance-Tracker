'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Copy, ExternalLink, Loader2, RefreshCw, Unplug, UserPlus } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useUserSettings } from '@/hooks/use-user-settings'
import { authFetch } from '@/lib/api-auth-client'
import { useLocale } from '@/components/locale-provider'
import { intlLocale, type LocalizedText } from '@/lib/i18n'

interface PendingCode {
  code: string
  expiresAt: number
  redirectUrl?: string
}

interface LinkStatus {
  linked: boolean
  displayName: string | null
  pictureUrl: string | null
  linkedAt: number | null
  addFriendUrl: string
  pending: PendingCode | null
}

const EXAMPLES: { text: LocalizedText; note: LocalizedText }[] = [
  {
    text: { th: 'ข้าวมันไก่ 60', en: 'Chicken rice 60', zh: '海南鸡饭 60' },
    note: { th: 'รายจ่ายทั่วไป', en: 'Everyday expense', zh: '日常支出' },
  },
  {
    text: { th: 'ราเมน 1200 เยน Wise', en: 'Ramen 1200 yen Wise', zh: '拉面 1200 日元 Wise' },
    note: {
      th: 'แยกสกุลเงินกับบัญชีให้เอง',
      en: 'Currency and account picked out for you',
      zh: '自动识别币种和账户',
    },
  },
  {
    text: {
      th: 'กาแฟ 80 kbank\nขนม 45 เงินสด',
      en: 'Coffee 80 kbank\nSnacks 45 cash',
      zh: '咖啡 80 kbank\n零食 45 现金',
    },
    note: {
      th: 'หลายบรรทัด = หลายรายการ',
      en: 'Several lines = several entries',
      zh: '多行 = 多笔记录',
    },
  },
  {
    text: {
      th: 'โอน 500 จาก scb ไป kbank',
      en: 'Transfer 500 from scb to kbank',
      zh: '从 scb 转 500 到 kbank',
    },
    note: { th: 'โอนระหว่างบัญชี', en: 'Transfer between accounts', zh: '账户间转账' },
  },
]

function minutesLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 60000))
}

export default function LinePage() {
  const { profile, loading: profileLoading } = useUserSettings()
  const { p, t, locale } = useLocale()
  const [status, setStatus] = useState<LinkStatus | null>(null)
  const [statusError, setStatusError] = useState(false)
  const [pending, setPending] = useState<PendingCode | null>(null)
  const [creating, setCreating] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  // Live from the profile snapshot — flips the moment the bot writes lineUserId.
  const isLinked = !!profile?.lineUserId
  const wasLinked = useRef<boolean | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/line/link-token')
      if (!res.ok) throw new Error(String(res.status))
      const data = (await res.json()) as LinkStatus
      setStatus(data)
      setPending(data.pending)
      setStatusError(false)
    } catch {
      setStatusError(true)
    }
  }, [])

  useEffect(() => {
    if (profileLoading) return
    void loadStatus()
  }, [profileLoading, isLinked, loadStatus])

  useEffect(() => {
    if (profileLoading) return
    if (wasLinked.current === false && isLinked) {
      toast.success(p({ th: 'เชื่อมต่อ LINE สำเร็จ', en: 'LINE connected', zh: 'LINE 连接成功' }))
      setPending(null)
    }
    wasLinked.current = isLinked
  }, [isLinked, profileLoading, p])

  useEffect(() => {
    if (!pending) return
    const id = window.setInterval(() => setNow(Date.now()), 15000)
    return () => window.clearInterval(id)
  }, [pending])

  const pendingActive = pending && pending.expiresAt > now ? pending : null

  const createCode = async () => {
    setCreating(true)
    try {
      const res = await authFetch('/api/line/link-token', { method: 'POST' })
      if (!res.ok) throw new Error(String(res.status))
      const data = await res.json()
      setPending({ code: data.token, expiresAt: data.expiresAt, redirectUrl: data.redirectUrl })
      setNow(Date.now())
    } catch {
      toast.error(
        p({
          th: 'สร้างรหัสไม่สำเร็จ ลองใหม่อีกครั้ง',
          en: "Couldn't create a code. Please try again.",
          zh: '生成代码失败，请重试。',
        })
      )
    } finally {
      setCreating(false)
    }
  }

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error(
        p({
          th: 'คัดลอกไม่สำเร็จ — พิมพ์รหัสเองได้เลย',
          en: "Couldn't copy — just type the code instead",
          zh: '复制失败——请手动输入代码',
        })
      )
    }
  }

  const unlink = async () => {
    setUnlinking(true)
    try {
      const res = await authFetch('/api/line/link-token', { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      toast.success(p({ th: 'ยกเลิกการเชื่อมต่อแล้ว', en: 'Disconnected', zh: '已断开连接' }))
    } catch {
      toast.error(
        p({ th: 'ยกเลิกการเชื่อมต่อไม่สำเร็จ', en: "Couldn't disconnect", zh: '断开连接失败' })
      )
    } finally {
      setUnlinking(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6" aria-busy="true">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  const displayName = status?.displayName ?? profile?.lineDisplayName ?? null
  const pictureUrl = status?.pictureUrl ?? profile?.linePictureUrl ?? null
  const disconnectLabel = p({ th: 'ยกเลิกการเชื่อมต่อ', en: 'Disconnect', zh: '断开连接' })

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{t('nav.line')}</h1>
          <Badge variant={isLinked ? 'default' : 'secondary'}>
            {isLinked
              ? p({ th: 'เชื่อมต่อแล้ว', en: 'Connected', zh: '已连接' })
              : p({ th: 'ยังไม่เชื่อมต่อ', en: 'Not connected', zh: '未连接' })}
          </Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          {p({
            th: 'พิมพ์รายการหรือส่งรูปสลิปในแชท LINE — AI แยกชื่อรายการ ยอดเงิน สกุลเงิน และบัญชีให้ แล้วกดบันทึกได้ทันที',
            en: 'Type an expense or send a receipt photo in LINE chat — AI picks out the item, amount, currency, and account so you can save it right away.',
            zh: '在 LINE 聊天中输入记录或发送收据照片——AI 会识别项目、金额、币种和账户，一键即可保存。',
          })}
        </p>
      </header>

      {isLinked ? (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 space-y-0">
            <Avatar className="size-10">
              {pictureUrl && <AvatarImage src={pictureUrl} alt="" />}
              <AvatarFallback>{(displayName ?? 'L').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <CardTitle className="truncate">
                {displayName ?? p({ th: 'บัญชี LINE', en: 'LINE account', zh: 'LINE 账户' })}
              </CardTitle>
              <CardDescription>
                {status?.linkedAt
                  ? (() => {
                      const date = new Date(status.linkedAt).toLocaleDateString(intlLocale(locale), {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })
                      return p({
                        th: `เชื่อมเมื่อ ${date}`,
                        en: `Connected ${date}`,
                        zh: `连接于 ${date}`,
                      })
                    })()
                  : p({
                      th: 'พร้อมบันทึกผ่านแชท',
                      en: 'Ready to log by chat',
                      zh: '可以通过聊天记账了',
                    })}
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={unlinking} className="shrink-0 text-muted-foreground">
                  {unlinking ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                  {disconnectLabel}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {p({
                      th: 'ยกเลิกการเชื่อมต่อ LINE?',
                      en: 'Disconnect LINE?',
                      zh: '断开 LINE 连接？',
                    })}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {p({
                      th: 'รายการที่บันทึกไว้แล้วยังอยู่ครบ แต่บอทจะรับรายการใหม่ไม่ได้จนกว่าจะเชื่อมใหม่',
                      en: "Entries you've already saved stay put, but the bot can't take new ones until you reconnect.",
                      zh: '已保存的记录会保留，但在重新连接前机器人无法接收新记录。',
                    })}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {p({ th: 'ไม่ใช่ตอนนี้', en: 'Not now', zh: '暂不' })}
                  </AlertDialogCancel>
                  <AlertDialogAction onClick={unlink} className="bg-destructive text-white hover:bg-destructive/90">
                    {disconnectLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent className="space-y-3 border-t pt-6">
            <h2 className="text-sm font-semibold">
              {p({ th: 'ลองพิมพ์ในแชท', en: 'Try typing in the chat', zh: '在聊天中试试输入' })}
            </h2>
            <ExampleList />
            <p className="text-xs text-muted-foreground text-pretty">
              {p({
                th: 'ไม่พิมพ์สกุลเงิน → ใช้สกุลของบัญชีนั้น (ตั้งได้ที่',
                en: "No currency typed → uses that account's currency (set it in",
                zh: '未输入币种 → 使用该账户的币种（可在',
              })}{' '}
              <Link href="/settings?tab=money" className="underline underline-offset-2">
                {p({ th: 'ตั้งค่า › เงิน', en: 'Settings › Money', zh: '设置 › 资金' })}
              </Link>
              {p({
                th: ') ถ้าไม่มีจะใช้สกุลเงินหลัก · พิมพ์',
                en: '), otherwise your main currency · Type',
                zh: '中设置），否则使用主币种 · 在聊天中输入',
              })}{' '}
              <span className="font-mono">help</span>{' '}
              {p({
                th: 'ในแชทเพื่อดูตัวอย่างอีกครั้ง',
                en: 'in the chat to see examples again',
                zh: '可再次查看示例',
              })}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {p({ th: 'เชื่อมต่อใน 2 ขั้นตอน', en: 'Connect in 2 steps', zh: '两步完成连接' })}
            </CardTitle>
            <CardDescription>
              {p({
                th: 'หน้านี้อัปเดตเองเมื่อเชื่อมสำเร็จ รีเฟรชได้โดยรหัสไม่หาย',
                en: "This page updates by itself once you're connected. Refreshing won't lose your code.",
                zh: '连接成功后此页面会自动更新，刷新也不会丢失代码。',
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="space-y-6">
              <li className="flex gap-3">
                <StepNumber n={1} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">
                    {p({
                      th: 'เพิ่มบอทเป็นเพื่อนใน LINE',
                      en: 'Add the bot as a friend on LINE',
                      zh: '在 LINE 中添加机器人为好友',
                    })}
                  </p>
                  <Button variant="outline" size="sm" asChild disabled={!status}>
                    <a href={status?.addFriendUrl} target="_blank" rel="noopener noreferrer">
                      <UserPlus className="size-4" />
                      {p({ th: 'เพิ่มเพื่อน', en: 'Add friend', zh: '添加好友' })}
                    </a>
                  </Button>
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n={2} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm font-medium">
                    {p({
                      th: 'สร้างรหัส แล้วส่งรหัสในแชทบอท',
                      en: 'Create a code, then send it in the bot chat',
                      zh: '生成代码，然后在机器人聊天中发送',
                    })}
                  </p>
                  {pendingActive ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code
                          className="rounded-md border bg-muted px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.2em] tabular-nums"
                          aria-label={`${p({ th: 'รหัสเชื่อมต่อ', en: 'Link code', zh: '连接代码' })} ${pendingActive.code.split('').join(' ')}`}
                        >
                          {pendingActive.code}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => copyCode(pendingActive.code)}>
                          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copied
                            ? p({ th: 'คัดลอกแล้ว', en: 'Copied', zh: '已复制' })
                            : p({ th: 'คัดลอก', en: 'Copy', zh: '复制' })}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pendingActive.redirectUrl && (
                          <Button size="sm" asChild>
                            <a href={pendingActive.redirectUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" />
                              {p({
                                th: 'เปิดแชทพร้อมรหัส',
                                en: 'Open chat with code',
                                zh: '打开聊天并填入代码',
                              })}
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={createCode} disabled={creating}>
                          {creating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                          {p({ th: 'สร้างรหัสใหม่', en: 'New code', zh: '重新生成代码' })}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground" aria-live="polite">
                        <Loader2 className="mr-1 inline size-3 animate-spin motion-reduce:animate-none" aria-hidden />
                        {(() => {
                          const mins = minutesLeft(pendingActive.expiresAt, now)
                          return p({
                            th: `รอการยืนยันจาก LINE · หมดอายุใน ${mins} นาที`,
                            en: `Waiting for LINE to confirm · expires in ${mins} min`,
                            zh: `等待 LINE 确认 · ${mins} 分钟后过期`,
                          })
                        })()}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button onClick={createCode} disabled={creating} size="sm">
                        {creating && <Loader2 className="size-4 animate-spin" />}
                        {pending
                          ? p({
                              th: 'รหัสหมดอายุ — สร้างใหม่',
                              en: 'Code expired — create a new one',
                              zh: '代码已过期——重新生成',
                            })
                          : p({ th: 'สร้างรหัส', en: 'Create code', zh: '生成代码' })}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {p({
                          th: 'ส่งแค่รหัส 6 ตัว หรือ',
                          en: 'Send just the 6-character code, or',
                          zh: '只需发送 6 位代码，或',
                        })}{' '}
                        <span className="font-mono">
                          /link {p({ th: 'รหัส', en: 'code', zh: '代码' })}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              </li>
            </ol>
            {statusError && (
              <p className="text-sm text-destructive" role="alert">
                {p({ th: 'โหลดสถานะไม่สำเร็จ', en: "Couldn't load status.", zh: '状态加载失败。' })}{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => void loadStatus()}>
                  {p({ th: 'ลองอีกครั้ง', en: 'Try again', zh: '重试' })}
                </button>
              </p>
            )}
            <div className="space-y-3 border-t pt-6">
              <h2 className="text-sm font-semibold">
                {p({
                  th: 'เชื่อมแล้วพิมพ์แบบนี้ได้เลย',
                  en: 'Once connected, type things like',
                  zh: '连接后可以这样输入',
                })}
              </h2>
              <ExampleList />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold tabular-nums"
      aria-hidden
    >
      {n}
    </span>
  )
}

function ExampleList() {
  const { p } = useLocale()
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {EXAMPLES.map((ex) => (
        <li key={ex.text.en} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="whitespace-pre-line font-mono text-foreground">{p(ex.text)}</span>
          <span className="text-xs text-muted-foreground sm:text-right">{p(ex.note)}</span>
        </li>
      ))}
      <li className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className="text-foreground">
          {p({ th: 'ส่งรูปสลิป / ใบเสร็จ', en: 'Send a slip / receipt photo', zh: '发送转账截图/收据照片' })}
        </span>
        <span className="text-xs text-muted-foreground sm:text-right">
          {p({ th: 'อ่านยอดจากรูปให้', en: 'Reads the amount from the photo', zh: '自动从照片读取金额' })}
        </span>
      </li>
    </ul>
  )
}
