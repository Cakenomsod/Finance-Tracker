'use client'

import { Construction, MessageCircle } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function LinePage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">LINE Bot</h1>
          <Badge variant="secondary">อยู่ในช่วงพัฒนา</Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty sm:text-base">
          บันทึกรายจ่ายผ่านแชท LINE — ฟีเจอร์นี้ยังไม่พร้อมใช้งาน
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              aria-hidden
            >
              <MessageCircle className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-balance">ยังไม่พร้อมเชื่อมต่อ</CardTitle>
              <CardDescription className="max-w-prose text-pretty">
                การเชื่อมต่อบอท คำสั่งแชท บันทึกซิงก์ และข้อความอัตโนมัติกำลังพัฒนาอยู่
                ตอนนี้ยังใช้บันทึกรายจ่ายผ่านแอปได้ตามปกติ
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Empty className="border-0 p-2 md:p-6">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Construction aria-hidden />
              </EmptyMedia>
              <EmptyTitle>อยู่ในช่วงพัฒนา</EmptyTitle>
              <EmptyDescription>
                จะแจ้งเมื่อเชื่อมต่อ LINE และบันทึกผ่านแชทพร้อมใช้งานจริง
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}
