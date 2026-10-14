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
import { useLocale } from '@/components/locale-provider'
import { intlLocale } from '@/lib/i18n'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function FriendsListSkeleton() {
  const { p } = useLocale()
  return (
    <div
      className="space-y-3"
      aria-busy="true"
      aria-label={p({ th: 'กำลังโหลดรายชื่อ', en: 'Loading contacts', zh: '正在加载联系人' })}
    >
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
  const { p, t, locale } = useLocale()
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

  const genericError = p({ th: 'เกิดข้อผิดพลาด', en: 'Something went wrong', zh: '出错了' })
  const addContactLabel = p({ th: 'เพิ่มรายชื่อ', en: 'Add contact', zh: '添加联系人' })
  const declineLabel = p({ th: 'ปฏิเสธ', en: 'Decline', zh: '拒绝' })
  const cancelLabel = t('common.cancel')
  const sentOnLabel = (seconds: number) => {
    const date = new Date(seconds * 1000).toLocaleDateString(intlLocale(locale))
    return p({ th: `ส่งเมื่อ ${date}`, en: `Sent ${date}`, zh: `发送于 ${date}` })
  }

  React.useEffect(() => {
    if (!hasContacts) setAddOpen(false)
  }, [hasContacts])

  const handleAddFriend = async () => {
    const email = searchEmail.trim()
    if (!email) return
    if (!EMAIL_PATTERN.test(email)) {
      setSearchError(
        p({ th: 'กรุณาใส่อีเมลให้ถูกต้อง', en: 'Enter a valid email address', zh: '请输入有效的邮箱地址' })
      )
      setSearchSuccess('')
      return
    }
    setSearching(true)
    setSearchError('')
    setSearchSuccess('')
    try {
      const found = await addFriend(email)
      const recipient = found.displayName || found.email
      setSearchSuccess(
        p({
          th: `ส่งคำขอไปยัง ${recipient} แล้ว — ดูได้ที่แท็บ “ส่งแล้ว”`,
          en: `Request sent to ${recipient} — see the “Sent” tab`,
          zh: `已向 ${recipient} 发送请求——可在“已发送”标签查看`,
        })
      )
      setSearchEmail('')
      setActiveTab('sent')
    } catch (e: unknown) {
      setSearchError(e instanceof Error ? e.message : genericError)
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
      const added = customName.trim()
      setCustomSuccess(
        p({
          th: `เพิ่ม “${added}” ในรายชื่อแล้ว`,
          en: `Added “${added}” to your contacts`,
          zh: `已将“${added}”添加到联系人`,
        })
      )
      setCustomName('')
      setActiveTab('friends')
      if (hasContacts) setAddOpen(false)
    } catch (e: unknown) {
      setCustomError(e instanceof Error ? e.message : genericError)
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
          <h1 className="text-2xl font-semibold tracking-tight text-balance">{t('nav.friends')}</h1>
          <p className="text-sm text-muted-foreground text-pretty max-w-prose">
            {p({
              th: 'เพิ่มเพื่อนเพื่อร่วมทริปและแชร์ค่าใช้จ่าย — มีบัญชีหรือเก็บเป็นรายชื่อส่วนตัวก็ได้',
              en: 'Add friends to join trips and split bills — with an account or as a private contact.',
              zh: '添加好友一起参加行程并分账——可以有账户，也可以只保存为私人联系人。',
            })}
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
            {showAddPanel ? p({ th: 'ปิดการเพิ่ม', en: 'Close', zh: '收起' }) : addContactLabel}
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
              <CardTitle className="text-base">{addContactLabel}</CardTitle>
              <CardDescription className="text-pretty max-w-prose">
                {p({
                  th: 'เลือกวิธีที่เหมาะกับคนนั้น — มีบัญชีในระบบ หรือเก็บชื่อไว้ใช้เอง',
                  en: 'Pick what fits — someone with an account, or just a name for your own use.',
                  zh: '选择合适的方式——对方有账户，或仅保存名字供自己使用。',
                })}
              </CardDescription>
            </div>
            <div
              className="inline-flex rounded-lg border bg-muted/40 p-1"
              role="tablist"
              aria-label={p({ th: 'วิธีเพิ่มรายชื่อ', en: 'How to add a contact', zh: '添加联系人方式' })}
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
                {p({ th: 'มีบัญชี', en: 'Has account', zh: '有账户' })}
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
                {p({ th: 'รายชื่อเอง', en: 'Name only', zh: '仅名字' })}
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {addMethod === 'account' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="friend-email">
                    {p({ th: 'อีเมลเพื่อน', en: "Friend's email", zh: '好友邮箱' })}
                  </Label>
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
                      {searching
                        ? p({ th: 'กำลังส่ง...', en: 'Sending…', zh: '发送中…' })
                        : p({ th: 'ส่งคำขอ', en: 'Send request', zh: '发送请求' })}
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
                  <Label htmlFor="custom-friend-name">
                    {p({ th: 'ชื่อในรายชื่อ', en: 'Contact name', zh: '联系人名称' })}
                  </Label>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="custom-friend-name"
                      placeholder={p({ th: 'เช่น น้องบี', en: 'e.g. Bee', zh: '例如：小明' })}
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
                      {addingCustom
                        ? p({ th: 'กำลังเพิ่ม...', en: 'Adding…', zh: '添加中…' })
                        : p({ th: 'เพิ่ม', en: 'Add', zh: '添加' })}
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-pretty">
                  {p({
                    th: 'เก็บไว้เฉพาะในบัญชีของคุณ — ใช้แบ่งค่าใช้จ่ายได้แม้เพื่อนยังไม่มีบัญชี',
                    en: "Saved only in your account — split bills even if they don't have an account yet.",
                    zh: '仅保存在你的账户中——即使对方还没有账户也能分账。',
                  })}
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
            {p({ th: 'รายชื่อ', en: 'Contacts', zh: '联系人' })}
            {totalContacts > 0 ? (
              <Badge variant="secondary" className="rounded-full tabular-nums">
                {totalContacts}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-4" aria-hidden />
            {p({ th: 'คำขอที่รอ', en: 'Pending', zh: '待处理' })}
            {pendingReceived.length > 0 ? (
              <Badge className="rounded-full tabular-nums">
                {pendingReceived.length}
              </Badge>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <UserPlus className="size-4" aria-hidden />
            {p({ th: 'ส่งแล้ว', en: 'Sent', zh: '已发送' })}
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
                  title={p({ th: 'ยังไม่มีรายชื่อ', en: 'No contacts yet', zh: '还没有联系人' })}
                  description={p({
                    th: 'เพิ่มเพื่อนที่มีบัญชี หรือเก็บชื่อไว้ใช้แบ่งค่าใช้จ่ายก่อนก็ได้',
                    en: 'Add a friend with an account, or save a name to split bills with.',
                    zh: '添加有账户的好友，或先保存名字用于分账。',
                  })}
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
                      {p({ th: 'เพิ่มรายชื่อแรก', en: 'Add your first contact', zh: '添加第一个联系人' })}
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-muted-foreground">
                    {p({
                      th: 'ลากไอคอนจับ หรือใช้ปุ่มขึ้น/ลง เพื่อจัดลำดับรายชื่อ',
                      en: 'Drag the handle or use the up/down buttons to reorder contacts.',
                      zh: '拖动手柄或使用上下按钮调整联系人顺序。',
                    })}
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
              <CardTitle className="text-base">
                {p({ th: 'คำขอที่ได้รับ', en: 'Received requests', zh: '收到的请求' })}
              </CardTitle>
              <CardDescription>
                {p({
                  th: 'ยอมรับเพื่อเพิ่มเป็นเพื่อนสำหรับทริปและแชร์ค่าใช้จ่าย',
                  en: 'Accept to add them as a friend for trips and shared expenses.',
                  zh: '接受后即可成为好友，一起参加行程并分摊费用。',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <FriendsListSkeleton />
              ) : pendingReceived.length === 0 ? (
                <EmptyTabState
                  icon={Clock}
                  title={p({ th: 'ไม่มีคำขอที่รอ', en: 'No pending requests', zh: '没有待处理的请求' })}
                  description={p({
                    th: 'เมื่อมีคนส่งคำขอมาหาคุณ จะแสดงที่นี่',
                    en: 'Requests sent to you will appear here.',
                    zh: '别人发给你的请求会显示在这里。',
                  })}
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
                                ? sentOnLabel(req.createdAt.seconds)
                                : p({ th: 'รอการตอบรับ', en: 'Awaiting response', zh: '等待回复' })}
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
                            {busy
                              ? p({ th: 'กำลังยอมรับ...', en: 'Accepting…', zh: '接受中…' })
                              : p({ th: 'ยอมรับ', en: 'Accept', zh: '接受' })}
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
                            {declineLabel}
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
              <CardTitle className="text-base">
                {p({ th: 'คำขอที่ส่งออกไป', en: 'Sent requests', zh: '已发送的请求' })}
              </CardTitle>
              <CardDescription>
                {p({
                  th: 'รอให้เพื่อนตอบรับ — ยกเลิกได้ทุกเมื่อ',
                  en: 'Waiting for them to accept — you can cancel anytime.',
                  zh: '等待对方接受——可随时取消。',
                })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <FriendsListSkeleton />
              ) : pendingSent.length === 0 ? (
                <EmptyTabState
                  icon={UserPlus}
                  title={p({ th: 'ยังไม่ได้ส่งคำขอ', en: 'No requests sent', zh: '尚未发送请求' })}
                  description={p({
                    th: 'ส่งคำขอด้วยอีเมลเมื่อเพื่อนมีบัญชีในระบบแล้ว',
                    en: 'Send a request by email once your friend has an account.',
                    zh: '好友注册账户后，可通过邮箱发送请求。',
                  })}
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
                      {p({ th: 'ส่งคำขอด้วยอีเมล', en: 'Send request by email', zh: '通过邮箱发送请求' })}
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-3">
                  {pendingSent.map((req) => {
                    const recipient =
                      req.toDisplayName?.trim() ||
                      p({
                        th: `ผู้ใช้ ${req.toUserId.slice(0, 6)}`,
                        en: `User ${req.toUserId.slice(0, 6)}`,
                        zh: `用户 ${req.toUserId.slice(0, 6)}`,
                      })
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
                              {p({ th: 'รอการยืนยัน', en: 'Awaiting confirmation', zh: '等待确认' })}
                              {req.createdAt?.seconds ? ` · ${sentOnLabel(req.createdAt.seconds)}` : ''}
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
                          {cancelLabel}
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
              {pendingAction?.type === 'decline'
                ? p({ th: 'ปฏิเสธคำขอ?', en: 'Decline request?', zh: '拒绝请求？' })
                : p({ th: 'ยกเลิกคำขอ?', en: 'Cancel request?', zh: '取消请求？' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingAction?.type === 'decline'
                ? p({
                    th: `ปฏิเสธคำขอจาก ${pendingAction.name} — จะไม่เพิ่มเป็นเพื่อน`,
                    en: `Decline the request from ${pendingAction.name} — they won't be added as a friend.`,
                    zh: `拒绝 ${pendingAction.name} 的请求——不会添加为好友。`,
                  })
                : p({
                    th: `ยกเลิกคำขอที่ส่งไปยัง ${pendingAction?.name ?? ''} — สามารถส่งใหม่ได้ภายหลัง`,
                    en: `Cancel the request to ${pendingAction?.name ?? ''} — you can send it again later.`,
                    zh: `取消发送给 ${pendingAction?.name ?? ''} 的请求——之后可以重新发送。`,
                  })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionBusy}>{cancelLabel}</AlertDialogCancel>
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
                ? p({ th: 'กำลังดำเนินการ...', en: 'Working…', zh: '处理中…' })
                : pendingAction?.type === 'decline'
                  ? declineLabel
                  : p({ th: 'ยืนยันยกเลิก', en: 'Cancel request', zh: '确认取消' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
