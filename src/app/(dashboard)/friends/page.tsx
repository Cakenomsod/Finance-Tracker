'use client'

import * as React from 'react'
import {
  UserPlus, UserCheck, Users,
  Clock, Check, X, Mail, UserRound, Trash2,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFriends } from '@/hooks/use-friends'

export default function FriendsPage() {
  const {
    friends, customFriends, pendingReceived, pendingSent,
    loading, addFriend, addCustomFriend, removeCustomFriend,
    accept, decline, remove,
  } = useFriends()
  const [searchEmail, setSearchEmail] = React.useState('')
  const [customName, setCustomName] = React.useState('')
  const [searching, setSearching] = React.useState(false)
  const [addingCustom, setAddingCustom] = React.useState(false)
  const [searchError, setSearchError] = React.useState('')
  const [searchSuccess, setSearchSuccess] = React.useState('')
  const [customError, setCustomError] = React.useState('')
  const [customSuccess, setCustomSuccess] = React.useState('')

  const handleAddFriend = async () => {
    if (!searchEmail.trim()) return
    setSearching(true)
    setSearchError('')
    setSearchSuccess('')
    try {
      const found = await addFriend(searchEmail.trim())
      setSearchSuccess(`ส่งคำขอเพื่อนไปยัง ${found.displayName || found.email} แล้ว!`)
      setSearchEmail('')
    } catch (e: any) {
      setSearchError(e.message || 'เกิดข้อผิดพลาด')
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
      setCustomSuccess(`เพิ่ม "${customName.trim()}" ในรายชื่อแล้ว`)
      setCustomName('')
    } catch (e: any) {
      setCustomError(e.message || 'เกิดข้อผิดพลาด')
    } finally {
      setAddingCustom(false)
    }
  }

  const totalContacts = friends.length + customFriends.length

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="text-muted-foreground">
          เพิ่มเพื่อนเพื่อร่วมทริปและแชร์ค่าใช้จ่าย
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="size-5" />
              เพิ่มเพื่อน (มีบัญชี)
            </CardTitle>
            <CardDescription>ค้นหาด้วย Email ของผู้ใช้ในระบบ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="email@example.com"
                  value={searchEmail}
                  onChange={(e) => { setSearchEmail(e.target.value); setSearchError(''); setSearchSuccess('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleAddFriend} disabled={searching || !searchEmail.trim()}>
                {searching ? 'กำลังค้นหา...' : 'ส่งคำขอ'}
              </Button>
            </div>
            {searchError && <p className="mt-2 text-sm text-destructive">{searchError}</p>}
            {searchSuccess && <p className="mt-2 text-sm text-primary">{searchSuccess}</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5" />
              เพิ่มรายชื่อเอง
            </CardTitle>
            <CardDescription>
              สำหรับคนที่ไม่มีบัญชี — เก็บไว้เฉพาะในบัญชีของคุณ
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Input
                placeholder="ชื่อเพื่อน เช่น น้องบี"
                value={customName}
                onChange={(e) => { setCustomName(e.target.value); setCustomError(''); setCustomSuccess('') }}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCustomFriend()}
                className="flex-1"
              />
              <Button onClick={handleAddCustomFriend} disabled={addingCustom || !customName.trim()}>
                {addingCustom ? 'กำลังเพิ่ม...' : 'เพิ่ม'}
              </Button>
            </div>
            {customError && <p className="mt-2 text-sm text-destructive">{customError}</p>}
            {customSuccess && <p className="mt-2 text-sm text-primary">{customSuccess}</p>}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="friends">
        <TabsList>
          <TabsTrigger value="friends" className="gap-2">
            <Users className="size-4" /> รายชื่อทั้งหมด
            {totalContacts > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full">{totalContacts}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending" className="gap-2">
            <Clock className="size-4" /> คำขอที่รอ
            {pendingReceived.length > 0 && (
              <Badge className="ml-1 rounded-full bg-destructive text-destructive-foreground">
                {pendingReceived.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="sent" className="gap-2">
            <UserPlus className="size-4" /> ส่งแล้ว
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>
              ) : totalContacts === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="mx-auto size-12 opacity-30" />
                  <p className="mt-3 text-sm">ยังไม่มีรายชื่อ — ลองเพิ่มเพื่อนหรือเพิ่มรายชื่อเองด้านบน</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {friends.map((friend) => (
                    <div key={friend.uid} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-primary/20 text-primary text-sm">
                            {friend.displayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{friend.displayName}</p>
                          <p className="text-xs text-muted-foreground">มีบัญชีในระบบ</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-primary border-primary/30">
                        <UserCheck className="mr-1 size-3" /> เพื่อน
                      </Badge>
                    </div>
                  ))}
                  {customFriends.map((cf) => (
                    <div key={cf.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-muted text-sm">
                            {cf.name.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{cf.name}</p>
                          <p className="text-xs text-muted-foreground">รายชื่อที่เพิ่มเอง (ไม่มีบัญชี)</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">รายชื่อเอง</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => cf.id && removeCustomFriend(cf.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pending" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>คำขอที่ได้รับ</CardTitle>
              <CardDescription>ผู้ใช้เหล่านี้ต้องการเป็นเพื่อนกับคุณ</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingReceived.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">ไม่มีคำขอที่รอ</p>
              ) : (
                <div className="space-y-3">
                  {pendingReceived.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-muted text-sm">
                            {req.fromDisplayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{req.fromDisplayName}</p>
                          <p className="text-xs text-muted-foreground">
                            {req.createdAt?.seconds
                              ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('th-TH')
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" onClick={() => accept(req.id!)} className="gap-1">
                          <Check className="size-3" /> ยอมรับ
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => decline(req.id!)} className="gap-1">
                          <X className="size-3" /> ปฏิเสธ
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sent" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>คำขอที่ส่งออกไป</CardTitle>
              <CardDescription>รอการตอบรับจากผู้รับ</CardDescription>
            </CardHeader>
            <CardContent>
              {pendingSent.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground text-sm">ยังไม่ได้ส่งคำขอ</p>
              ) : (
                <div className="space-y-3">
                  {pendingSent.map((req) => (
                    <div key={req.id} className="flex items-center justify-between rounded-lg border p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback className="bg-muted text-sm">??</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-muted-foreground">รอการยืนยัน...</p>
                          <p className="text-xs text-muted-foreground">
                            ส่งเมื่อ {req.createdAt?.seconds
                              ? new Date(req.createdAt.seconds * 1000).toLocaleDateString('th-TH')
                              : ''}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(req.id!)}
                      >
                        <X className="size-4" /> ยกเลิก
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
