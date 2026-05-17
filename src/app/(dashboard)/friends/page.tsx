'use client'

import * as React from 'react'
import {
  UserPlus, UserCheck, UserX, Search, Users,
  Clock, Check, X, Mail,
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useFriends } from '@/hooks/use-friends'
import { cn } from '@/lib/utils'

export default function FriendsPage() {
  const { friends, pendingReceived, pendingSent, loading, addFriend, accept, decline, remove } = useFriends()
  const [searchEmail, setSearchEmail] = React.useState('')
  const [searching, setSearching] = React.useState(false)
  const [searchError, setSearchError] = React.useState('')
  const [searchSuccess, setSearchSuccess] = React.useState('')

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

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">Friends</h1>
        <p className="text-muted-foreground">
          เพิ่มเพื่อนเพื่อร่วมทริปและแชร์ค่าใช้จ่าย
        </p>
      </div>

      {/* Add Friend */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" />
            เพิ่มเพื่อน
          </CardTitle>
          <CardDescription>ค้นหาด้วย Email ของผู้ใช้</CardDescription>
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

      {/* Tabs */}
      <Tabs defaultValue="friends">
        <TabsList>
          <TabsTrigger value="friends" className="gap-2">
            <Users className="size-4" /> เพื่อน
            {friends.length > 0 && (
              <Badge variant="secondary" className="ml-1 rounded-full">{friends.length}</Badge>
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

        {/* Friends List */}
        <TabsContent value="friends" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">กำลังโหลด...</p>
              ) : friends.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="mx-auto size-12 opacity-30" />
                  <p className="mt-3 text-sm">ยังไม่มีเพื่อน — ลองค้นหา email ด้านบน</p>
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
                          <p className="text-xs text-muted-foreground">{friend.uid}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-primary border-primary/30">
                          <UserCheck className="mr-1 size-3" /> เพื่อน
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Pending Received */}
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

        {/* Sent Requests */}
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
