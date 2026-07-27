'use client'

import * as React from 'react'
import {
  UserPlus,
  Users,
  Clock,
  Check,
  X,
  Mail,
  UserRound,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { SortableFriendList } from '@/components/friends/sortable-friend-list'
import { useFriends } from '@/hooks/use-friends'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FriendsListSkeleton() {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="กำลังโหลดรายชื่อ">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-lg border p-4"
        >
          <Skeleton className="size-4 shrink-0 rounded-sm" />
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48 max-w-full" />
          </div>
          <Skeleton className="h-6 w-16 shrink-0 rounded-md" />
        </div>
      ))}
    </div>
  )
}

function EmptyTabState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <Icon className="size-10 text-muted-foreground/50" aria-hidden />
      <p className="mt-4 text-base font-medium text-balance">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground text-pretty">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

type PendingAction =
  | { type: 'decline'; id: string; name: string }
  | { type: 'cancel'; id: string; name: string }
  | null

export default function FriendsPage() {
  const {
    friendListItems, pendingReceived, pendingSent,
    loading, addFriend, addCustomFriend, removeCustomFriend,
    reorderContacts, accept, decline, remove, saveContactAliases,
  } = useFriends()
  const [searchEmail, setSearchEmail] = React.useState('')
  const [customName, setCustomName] = React.useState('')
  const [searching, setSearching] = React.useState(false)
  const [addingCustom, setAddingCustom] = React.useState(false)
  const [searchError, setSearchError] = React.useState('')
  const [searchSuccess, setSearchSuccess] = React.useState('')
  const [customError, setCustomError] = React.useState('')
  const [customSuccess, setCustomSuccess] = React.useState('')
  const [addOpen, setAddOpen] = React.useState(false)
  const [addMethod, setAddMethod] = React.useState<'account' | 'custom'>('account')
  const [busyRequestId, setBusyRequestId] = React.useState<string | null>(null)
  const [pendingAction, setPendingAction] = React.useState<PendingAction>(null)
  const [actionBusy, setActionBusy] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState('friends')

  const totalContacts = friendListItems.length
  const hasContacts = totalContacts > 0
  const showAddPanel = !hasContacts || addOpen

  React.useEffect(() => {
    if (!hasContacts) setAddOpen(false)
  }, [hasContacts])

  const handleAddFriend = async () => {
    const email = searchEmail.trim()
    if (!email) return
    if (!EMAIL_PATTERN.test(email)) {
      setSearchError('กรุณาใส่อีเมลให้ถูกต้อง')
      setSearchSuccess('')
      return
    }
    setSearching(true)
    setSearchError('')
    setSearchSuccess('')
    try {
      const found = await addFriend(email)
      setSearchSuccess(`ส่งคำขอไปยัง ${found.displayName || found.email} แล้ว — ดูได้ที่แท็บ “ส่งแล้ว”`)
      setSearchEmail('')
      setActiveTab('sent')
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setSearching(false)
    }
  }

  const handleAddCustomFriend = async () => {
    if (!customName.trim()) return
    setAddingCustom(true)
    setCustomError('')
    setCustomSuccess('')
    try {
      await addCustomFriend(customName.trim())
      setCustomSuccess(`เพิ่ม “${customName.trim()}” ในรายชื่อแล้ว`)
      setCustomName('')
      setActiveTab('friends')
      if (hasContacts) setAddOpen(false)
    } catch (e: unknown) {
      setCustomError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setAddingCustom(false)
    }
  }

  const handleAccept = async (id: string) => {
    setBusyRequestId(id)
    try {
      await accept(id)
    } finally {
      setBusyRequestId(null)
    }
  }

  const confirmPendingAction = async () => {
    if (!pendingAction) return
    setActionBusy(true)
    try {
      if (pendingAction.type === 'decline') {
        await decline(pendingAction.id)
      } else {
        await remove(pendingAction.id)
      }
      setPendingAction(null)
    } finally {
      setActionBusy(false)
    }
  }

  const openAdd = (method: 'account' | 'custom' = 'account') => {
    setAddMethod(method)
    setAddOpen(true)
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">เพื่อน</h1>
          <p className="text-sm text-muted-foreground text-pretty max-w-prose">
            เพิ่มเพื่อนเพื่อร่วมทริปและแชร์ค่าใช้จ่าย — มีบัญชีหรือเก็บเป็นรายชื่อส่วนตัวก็ได้
          </p>
        </div>
        {hasContacts ? (
          <Button
            className="shrink-0 gap-2 self-start"
            variant={showAddPanel ? 'outline' : 'default'}
            onClick={() => (showAddPanel ? setAddOpen(false) : openAdd())}
            aria-expanded={showAddPanel}
            aria-controls="friends-add-panel"
          >
            <UserPlus className="size-4" aria-hidden />
            {showAddPanel ? 'ปิดการเพิ่ม' : 'เพิ่มรายชื่อ'}
          </Button>
        ) : null}
      </div>

      {showAddPanel ? (
        <Card
          id="friends-add-panel"
          className="shadow-sm animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">เพิ่มรายชื่อ</CardTitle>
              <CardDescription className="text-pretty max-w-prose">
                เลือกวิธีที่เหมาะกับคนนั้น — มีบัญชีในระบบ หรือเก็บชื่อไว้ใช้เอง
              </CardDescription>
            </div>
            <div
              className="inline-flex rounded-lg border bg-muted/40 p-1"
              role="tablist"
              aria-label="วิธีเพิ่มรายชื่อ"
            >
              <button
                type="button"
                role="tab"
                aria-selected={addMethod === 'account'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  addMethod === 'account'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setAddMethod('account')}
              >
                <Mail className="size-3.5" aria-hidden />
                มีบัญชี
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={addMethod === 'custom'}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-200 motion-reduce:transition-none',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  addMethod === 'custom'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
                onClick={() => setAddMethod('custom')}
              >
                <UserRound className="size-3.5" aria-hidden />
                รายชื่อเอง
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {addMethod === 'account' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="friend-email">อีเมลเพื่อน</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Mail
                        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                        aria-hidden
                      />
                      <Input
                        id="friend-email"
                        type="email"
                        inputMode="email"
                        autoComplete="email"
                        placeholder="email@example.com"
                        value={searchEmail}
                        onChange={(e) => {
                          setSearchEmail(e.target.value)
                          setSearchError('')
                          setSearchSuccess('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && void handleAddFriend()}
                        className="pl-9"
                        aria-invalid={!!searchError}
                        aria-describedby={searchError ? 'friend-email-error' : searchSuccess ? 'friend-email-success' : undefined}
                      />
                    </div>
                    <Button
                      onClick={() => void handleAddFriend()}
                      disabled={searching || !searchEmail.trim()}
                      className="sm:shrink-0"
                    >
                      {searching ? 'กำลังส่ง...' : 'ส่งคำขอ'}
                    </Button>
                  </div>
                </div>
                {searchError ? (
                  <p id="friend-email-error" role="alert" className="text-sm text-destructive">
                    {searchError}
                  </p>
                ) : null}
                {searchSuccess ? (
                  <p id="friend-email-success" role="status" className="text-sm text-primary">
                    {searchSuccess}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="custom-friend-name">ชื่อในรายชื่อ</Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="custom-friend-name"
                      placeholder="เช่น น้องบี"
                      value={customName}
                      onChange={(e) => {
                        setCustomName(e.target.value)
                        setCustomError('')
                        setCustomSuccess('')
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && void handleAddCustomFriend()}
                      className="flex-1"
                      aria-invalid={!!customError}
                      aria-describedby={customError ? 'custom-friend-error' : customSuccess ? 'custom-friend-success' : undefined}
                    />
                    <Button
                      onClick={() => void handleAddCustomFriend()}
                      disabled={addingCustom || !customName.trim()}
                      className="sm:shrink-0"
                    >
                      {addingCustom ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-pretty">
                  เก็บไว้เฉพาะในบัญชีของคุณ — ใช้แบ่งค่าใช้จ่ายได้แม้เพื่อนยังไม่มีบัญชี
                </p>
                {customError ? (
                  <p id="custom-friend-error" role="alert" className="text-sm text-destructive">
                    {customError}
                  </p>
                ) : null}
                {customSuccess ? (
                  <p id="custom-friend-success" role="status" className="text-sm text-primary">
                    {customSuccess}
                  </p>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-4">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:w-auto sm:flex-nowrap">
          <TabsTrigger value="friends" className="gap-2">
            <Users className="size-4" aria-hidden />
            รายชื่อ
            {totalContacts > 0 ? (
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {totalContacts}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-4" aria-hidden />
            คำขอที่รอ
            {pendingReceived.length > 0 ? (
              <Badge className="rounded-full bg-destructive text-destructive-foreground tabular-nums">
                {pendingReceived.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <UserPlus className="size-4" aria-hidden />
            ส่งแล้ว
            {pendingSent.length > 0 ? (
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {pendingSent.length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="friends"
          className="mt-0 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              {loading ? (
                <FriendsListSkeleton />
              ) : totalContacts === 0 ? (
                <EmptyTabState
                  icon={Users}
                  title="ยังไม่มีรายชื่อ"
                  description="เพิ่มเพื่อนที่มีบัญชี หรือเก็บชื่อไว้ใช้แบ่งค่าใช้จ่ายก่อนก็ได้"
                  action={
                    <Button
                      className="gap-2"
                      onClick={() => {
                        openAdd('account')
                        requestAnimationFrame(() => {
                          document.getElementById('friend-email')?.focus()
                        })
                      }}
                    >
                      <UserPlus className="size-4" aria-hidden />
                      เพิ่มรายชื่อแรก
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    ลากไอคอนจับ หรือใช้ปุ่มขึ้น/ลง เพื่อจัดลำดับรายชื่อ
                  </p>
                  <SortableFriendList
                    items={friendListItems}
                    onReorder={reorderContacts}
                    onRemoveCustom={removeCustomFriend}
                    onSaveAliases={saveContactAliases}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="pending"
          className="mt-0 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">คำขอที่ได้รับ</CardTitle>
              <CardDescription>
                ยอมรับเพื่อเพิ่มเป็นเพื่อนสำหรับทริปและแชร์ค่าใช้จ่าย
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <FriendsListSkeleton />
              ) : pendingReceived.length === 0 ? (
                <EmptyTabState
                  icon={Clock}
                  title="ไม่มีคำขอที่รอ"
                  description="เมื่อมีคนส่งคำขอมาหาคุณ จะแสดงที่นี่"
                />
              ) : (
                <ul className="space-y-3">
                  {pendingReceived.map((req) => {
                    const busy = busyRequestId === req.id
                    return (
                      <li
                        key={req.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between motion-reduce:transition-none"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-10 shrink-0">
                            <AvatarFallback className="bg-muted text-sm">
                              {req.fromDisplayName.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{req.fromDisplayName}</p>
                            <p className="text-xs text-muted-foreground">
                              {req.createdAt?.seconds
                                ? `ส่งเมื่อ ${new Date(req.createdAt.seconds * 1000).toLocaleDateString('th-TH')}`
                                : 'รอการตอบรับ'}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                          <Button
                            size="sm"
                            className="min-h-9 flex-1 gap-1 sm:flex-none"
                            disabled={busy}
                            onClick={() => req.id && void handleAccept(req.id)}
                          >
                            <Check className="size-3.5" aria-hidden />
                            {busy ? 'กำลังยอมรับ...' : 'ยอมรับ'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="min-h-9 flex-1 gap-1 sm:flex-none"
                            disabled={busy}
                            onClick={() =>
                              req.id &&
                              setPendingAction({
                                type: 'decline',
                                id: req.id,
                                name: req.fromDisplayName,
                              })
                            }
                          >
                            <X className="size-3.5" aria-hidden />
                            ปฏิเสธ
                          </Button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent
          value="sent"
          className="mt-0 animate-in fade-in-0 duration-200 fill-mode-both motion-reduce:animate-none"
        >
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">คำขอที่ส่งออกไป</CardTitle>
              <CardDescription>รอให้เพื่อนตอบรับ — ยกเลิกได้ทุกเมื่อ</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <FriendsListSkeleton />
              ) : pendingSent.length === 0 ? (
                <EmptyTabState
                  icon={UserPlus}
                  title="ยังไม่ได้ส่งคำขอ"
                  description="ส่งคำขอด้วยอีเมลเมื่อเพื่อนมีบัญชีในระบบแล้ว"
                  action={
                    <Button
                      variant="outline"
                      className="gap-2"
                      onClick={() => {
                        openAdd('account')
                        setAddOpen(true)
                      }}
                    >
                      <Mail className="size-4" aria-hidden />
                      ส่งคำขอด้วยอีเมล
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {pendingSent.map((req) => {
                    const recipient =
                      req.toDisplayName?.trim() ||
                      `ผู้ใช้ ${req.toUserId.slice(0, 6)}`
                    const initials = recipient.substring(0, 2).toUpperCase()
                    return (
                      <li
                        key={req.id}
                        className="flex flex-col gap-3 rounded-lg border p-4 transition-colors duration-200 sm:flex-row sm:items-center sm:justify-between motion-reduce:transition-none"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar className="size-10 shrink-0">
                            <AvatarFallback className="bg-muted text-sm">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{recipient}</p>
                            <p className="text-xs text-muted-foreground">
                              รอการยืนยัน
                              {req.createdAt?.seconds
                                ? ` · ส่งเมื่อ ${new Date(req.createdAt.seconds * 1000).toLocaleDateString('th-TH')}`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="min-h-9 self-start text-destructive hover:text-destructive sm:self-auto"
                          onClick={() =>
                            req.id &&
                            setPendingAction({
                              type: 'cancel',
                              id: req.id,
                              name: recipient,
                            })
                          }
                        >
                          <X className="size-4" aria-hidden />
                          ยกเลิก
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={!!pendingAction}
        onOpenChange={(open) => {
          if (!open && !actionBusy) setPendingAction(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingAction?.type === 'decline' ? 'ปฏิเสธคำขอ?' : 'ยกเลิกคำขอ?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'decline'
                ? `ปฏิเสธคำขอจาก ${pendingAction.name} — จะไม่เพิ่มเป็นเพื่อน`
                : `ยกเลิกคำขอที่ส่งไปยัง ${pendingAction?.name ?? ''} — สามารถส่งใหม่ได้ภายหลัง`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction
              disabled={actionBusy}
              onClick={(e) => {
                e.preventDefault()
                void confirmPendingAction()
              }}
              className={
                pendingAction?.type === 'decline'
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
            >
              {actionBusy
                ? 'กำลังดำเนินการ...'
                : pendingAction?.type === 'decline'
                  ? 'ปฏิเสธ'
                  : 'ยืนยันยกเลิก'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
