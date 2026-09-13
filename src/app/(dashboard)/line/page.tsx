'use client'

import { useState } from 'react'
import { CheckCircle2, MessageCircle, Unplug, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useUserSettings } from '@/hooks/use-user-settings'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

export default function LinePage() {
  const { profile, loading } = useUserSettings()
  const [isLinking, setIsLinking] = useState(false)
  const [isUnlinking, setIsUnlinking] = useState(false)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null)
  const router = useRouter()

  const isLinked = !!profile?.lineUserId

  const handleLink = async () => {
    setIsLinking(true)
    try {
      const res = await fetch('/api/line/link-token', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to generate link token')
      const data = await res.json()
      
      if (data.redirectUrl) {
        // Extract token from redirectUrl (it's encoded like %2Flink%20<token>)
        const match = data.redirectUrl.match(/%2Flink%20([a-zA-Z0-9]+)/i);
        if (match) {
          setLinkToken(match[1]);
        }
        setRedirectUrl(data.redirectUrl);
        // Try to open automatically
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 1500);
      } else {
        throw new Error('No redirect URL returned')
      }
    } catch (error) {
      console.error(error)
      toast.error('เกิดข้อผิดพลาดในการสร้างลิงก์เชื่อมต่อ')
    } finally {
      setIsLinking(false)
    }
  }

  const handleUnlink = async () => {
    setIsUnlinking(true)
    try {
      const res = await fetch('/api/line/link-token', { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to unlink')
      toast.success('ยกเลิกการเชื่อมต่อสำเร็จ')
      router.refresh()
    } catch (error) {
      console.error(error)
      toast.error('เกิดข้อผิดพลาดในการยกเลิกการเชื่อมต่อ')
    } finally {
      setIsUnlinking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-6 p-4 sm:p-6 items-center justify-center min-h-[400px]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl mx-auto">
      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">LINE Bot Integration</h1>
          <Badge variant={isLinked ? 'default' : 'secondary'} className={isLinked ? 'bg-green-600 hover:bg-green-700' : ''}>
            {isLinked ? 'เชื่อมต่อแล้ว' : 'ยังไม่ได้เชื่อมต่อ'}
          </Badge>
        </div>
        <p className="max-w-prose text-sm text-muted-foreground text-pretty sm:text-base">
          บันทึกรายจ่ายผ่านแชท LINE พร้อม AI วิเคราะห์รายการและยอดเงินอัตโนมัติ
        </p>
      </header>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                isLinked ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-500' : 'bg-muted text-muted-foreground'
              }`}
              aria-hidden
            >
              <MessageCircle className="size-5" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <CardTitle className="text-balance">
                {isLinked ? 'เชื่อมต่อบัญชีสำเร็จ' : 'ยังไม่พร้อมใช้งาน'}
              </CardTitle>
              <CardDescription className="max-w-prose text-pretty">
                {isLinked 
                  ? 'คุณสามารถพิมพ์รายการรายจ่าย หรือส่งรูปสลิปโอนเงินมาที่ LINE Bot เพื่อบันทึกได้ทันที'
                  : 'กรุณาเชื่อมต่อบัญชีกับ LINE Bot ก่อนเพื่อเริ่มใช้งานการบันทึกผ่านแชท'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isLinked ? (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col items-center justify-center text-center space-y-4">
              <div className="rounded-full bg-muted p-4">
                <Unplug className="size-8 text-muted-foreground" />
              </div>
              
              {!linkToken ? (
                <div className="space-y-2">
                  <h3 className="font-semibold leading-none tracking-tight">เพิ่มบอทเป็นเพื่อนและเชื่อมต่อบัญชี</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    คลิกที่ปุ่มด้านล่างเพื่อเปิดแอปพลิเคชัน LINE และดำเนินการเชื่อมต่อบัญชีให้เสร็จสิ้น
                  </p>
                </div>
              ) : (
                <div className="space-y-4 w-full max-w-sm animate-in fade-in zoom-in duration-300">
                  <h3 className="font-semibold leading-none tracking-tight text-green-600">สร้างรหัสเชื่อมต่อสำเร็จ!</h3>
                  <p className="text-sm text-muted-foreground">
                    ระบบกำลังเปิดแอป LINE อัตโนมัติ... หากแอปไม่เปิด กรุณาคัดลอกข้อความด้านล่างนี้ไปพิมพ์ส่งในแชทบอท LINE ด้วยตนเอง
                  </p>
                  <div className="bg-muted p-4 rounded-md flex items-center justify-between gap-2 border border-border/50">
                    <code className="text-lg font-mono font-bold">/link {linkToken}</code>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        navigator.clipboard.writeText(`/link ${linkToken}`)
                        toast.success('คัดลอกข้อความแล้ว')
                      }}
                    >
                      คัดลอก
                    </Button>
                  </div>
                  {redirectUrl && (
                    <Button variant="secondary" className="w-full" onClick={() => window.location.href = redirectUrl}>
                      เปิดแอป LINE อีกครั้ง
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 space-y-6">
              <div className="flex items-center gap-4 text-sm">
                <CheckCircle2 className="size-6 text-green-500" />
                <div className="space-y-1">
                  <p className="font-medium leading-none">พร้อมบันทึกรายจ่าย</p>
                  <p className="text-muted-foreground">LINE ID ของคุณเชื่อมต่อกับระบบแล้ว</p>
                </div>
              </div>
              
              <div className="space-y-3 bg-muted/50 p-4 rounded-md text-sm">
                <h4 className="font-medium">ตัวอย่างการใช้งาน</h4>
                <ul className="list-disc list-inside space-y-1.5 text-muted-foreground">
                  <li>พิมพ์ข้อความ: <span className="font-mono bg-background px-1 py-0.5 rounded text-foreground">ข้าวผัดกะเพรา 50 บาท</span></li>
                  <li>พิมพ์หลายรายการ: <span className="font-mono bg-background px-1 py-0.5 rounded text-foreground">กาแฟ 80 ขนม 40</span></li>
                  <li>ส่งรูปภาพ: ถ่ายรูปหรือเลือกรูปสลิปโอนเงิน/ใบเสร็จ</li>
                </ul>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-end gap-3 border-t bg-muted/20 px-6 py-4">
          {!isLinked ? (
            <Button 
              onClick={handleLink} 
              disabled={isLinking || !!linkToken} 
              className="w-full sm:w-auto bg-[#06C755] hover:bg-[#05b34c] text-white"
            >
              {isLinking ? <Loader2 className="size-4 animate-spin mr-2" /> : <MessageCircle className="size-4 mr-2" />}
              {linkToken ? 'กำลังเชื่อมต่อ...' : 'เชื่อมต่อกับ LINE'}
            </Button>
          ) : (
            <Button onClick={handleUnlink} disabled={isUnlinking} variant="destructive" className="w-full sm:w-auto">
              {isUnlinking ? <Loader2 className="size-4 animate-spin mr-2" /> : <Unplug className="size-4 mr-2" />}
              ยกเลิกการเชื่อมต่อ
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
