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

const EXAMPLES: { text: string; note: string }[] = [
  { text: 'ข้าวมันไก่ 60', note: 'รายจ่ายทั่วไป' },
  { text: 'ราเมน 1200 เยน Wise', note: 'แยกสกุลเงินกับบัญชีให้เอง' },
  { text: 'กาแฟ 80 kbank\nขนม 45 เงินสด', note: 'หลายบรรทัด = หลายรายการ' },
  { text: 'โอน 500 จาก scb ไป kbank', note: 'โอนระหว่างบัญชี' },
]

function minutesLeft(expiresAt: number, now: number) {
  return Math.max(0, Math.ceil((expiresAt - now) / 60000))
}

export default function LinePage() {
  const { profile, loading: profileLoading } = useUserSettings()
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
      toast.success('เชื่อมต่อ LINE สำเร็จ')
      setPending(null)
    }
    wasLinked.current = isLinked
  }, [isLinked, profileLoading])

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
      toast.error('สร้างรหัสไม่สำเร็จ ลองใหม่อีกครั้ง')
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
      toast.error('คัดลอกไม่สำเร็จ — พิมพ์รหัสเองได้เลย')
    }
  }

  const unlink = async () => {
    setUnlinking(true)
    try {
      const res = await authFetch('/api/line/link-token', { method: 'DELETE' })
      if (!res.ok) throw new Error(String(res.status))
      toast.success('ยกเลิกการเชื่อมต่อแล้ว')
    } catch {
      toast.error('ยกเลิกการเชื่อมต่อไม่สำเร็จ')
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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">LINE Bot</h1>
          <Badge variant={isLinked ? 'default' : 'secondary'}>
            {isLinked ? 'เชื่อมต่อแล้ว' : 'ยังไม่เชื่อมต่อ'}
          </Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty">
          พิมพ์รายการหรือส่งรูปสลิปในแชท LINE — AI แยกชื่อรายการ ยอดเงิน สกุลเงิน และบัญชีให้ แล้วกดบันทึกได้ทันที
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
              <CardTitle className="truncate">{displayName ?? 'บัญชี LINE'}</CardTitle>
              <CardDescription>
                {status?.linkedAt
                  ? `เชื่อมเมื่อ ${new Date(status.linkedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`
                  : 'พร้อมบันทึกผ่านแชท'}
              </CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={unlinking} className="shrink-0 text-muted-foreground">
                  {unlinking ? <Loader2 className="size-4 animate-spin" /> : <Unplug className="size-4" />}
                  ยกเลิกการเชื่อมต่อ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยกเลิกการเชื่อมต่อ LINE?</AlertDialogTitle>
                  <AlertDialogDescription>
                    รายการที่บันทึกไว้แล้วยังอยู่ครบ แต่บอทจะรับรายการใหม่ไม่ได้จนกว่าจะเชื่อมใหม่
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ไม่ใช่ตอนนี้</AlertDialogCancel>
                  <AlertDialogAction onClick={unlink} className="bg-destructive text-white hover:bg-destructive/90">
                    ยกเลิกการเชื่อมต่อ
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardHeader>
          <CardContent className="space-y-3 border-t pt-6">
            <h2 className="text-sm font-semibold">ลองพิมพ์ในแชท</h2>
            <ExampleList />
            <p className="text-xs text-muted-foreground text-pretty">
              ไม่พิมพ์สกุลเงิน → ใช้สกุลของบัญชีนั้น (ตั้งได้ที่{' '}
              <Link href="/settings?tab=money" className="underline underline-offset-2">
                ตั้งค่า › เงิน
              </Link>
              ) ถ้าไม่มีจะใช้สกุลเงินหลัก · พิมพ์{' '}
              <span className="font-mono">help</span> ในแชทเพื่อดูตัวอย่างอีกครั้ง
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>เชื่อมต่อใน 2 ขั้นตอน</CardTitle>
            <CardDescription>หน้านี้อัปเดตเองเมื่อเชื่อมสำเร็จ รีเฟรชได้โดยรหัสไม่หาย</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ol className="space-y-6">
              <li className="flex gap-3">
                <StepNumber n={1} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="text-sm font-medium">เพิ่มบอทเป็นเพื่อนใน LINE</p>
                  <Button variant="outline" size="sm" asChild disabled={!status}>
                    <a href={status?.addFriendUrl} target="_blank" rel="noopener noreferrer">
                      <UserPlus className="size-4" />
                      เพิ่มเพื่อน
                    </a>
                  </Button>
                </div>
              </li>
              <li className="flex gap-3">
                <StepNumber n={2} />
                <div className="min-w-0 flex-1 space-y-3">
                  <p className="text-sm font-medium">สร้างรหัส แล้วส่งรหัสในแชทบอท</p>
                  {pendingActive ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <code
                          className="rounded-md border bg-muted px-3 py-1.5 font-mono text-xl font-semibold tracking-[0.2em] tabular-nums"
                          aria-label={`รหัสเชื่อมต่อ ${pendingActive.code.split('').join(' ')}`}
                        >
                          {pendingActive.code}
                        </code>
                        <Button variant="outline" size="sm" onClick={() => copyCode(pendingActive.code)}>
                          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                          {copied ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {pendingActive.redirectUrl && (
                          <Button size="sm" asChild>
                            <a href={pendingActive.redirectUrl} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="size-4" />
                              เปิดแชทพร้อมรหัส
                            </a>
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={createCode} disabled={creating}>
                          {creating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                          สร้างรหัสใหม่
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground" aria-live="polite">
                        <Loader2 className="mr-1 inline size-3 animate-spin motion-reduce:animate-none" aria-hidden />
                        รอการยืนยันจาก LINE · หมดอายุใน {minutesLeft(pendingActive.expiresAt, now)} นาที
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button onClick={createCode} disabled={creating} size="sm">
                        {creating && <Loader2 className="size-4 animate-spin" />}
                        {pending ? 'รหัสหมดอายุ — สร้างใหม่' : 'สร้างรหัส'}
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        ส่งแค่รหัส 6 ตัว หรือ <span className="font-mono">/link รหัส</span> ก็ได้
                      </p>
                    </div>
                  )}
                </div>
              </li>
            </ol>
            {statusError && (
              <p className="text-sm text-destructive" role="alert">
                โหลดสถานะไม่สำเร็จ{' '}
                <button type="button" className="underline underline-offset-2" onClick={() => void loadStatus()}>
                  ลองอีกครั้ง
                </button>
              </p>
            )}
            <div className="space-y-3 border-t pt-6">
              <h2 className="text-sm font-semibold">เชื่อมแล้วพิมพ์แบบนี้ได้เลย</h2>
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
  return (
    <ul className="divide-y rounded-lg border text-sm">
      {EXAMPLES.map((ex) => (
        <li key={ex.text} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
          <span className="whitespace-pre-line font-mono text-foreground">{ex.text}</span>
          <span className="text-xs text-muted-foreground sm:text-right">{ex.note}</span>
        </li>
      ))}
      <li className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
        <span className="text-foreground">ส่งรูปสลิป / ใบเสร็จ</span>
        <span className="text-xs text-muted-foreground sm:text-right">อ่านยอดจากรูปให้</span>
      </li>
    </ul>
  )
}
