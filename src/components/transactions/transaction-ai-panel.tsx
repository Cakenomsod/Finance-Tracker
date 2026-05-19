'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { receiptParseToTransactionDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Transaction } from '@/lib/firestore-types'
import { toast } from 'sonner'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type: 'text' | 'image' | 'draft'
  draft?: ReceiptParseResult
  imagePreview?: string
}

export interface TransactionAiPanelProps {
  currency?: 'THB' | 'JPY'
  onOpenDraftForm: (draft: Omit<Transaction, 'id' | 'createdAt' | 'userId'>) => void
}

export function TransactionAiPanel({
  currency = 'THB',
  onOpenDraftForm,
}: TransactionAiPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [parsing, setParsing] = React.useState(false)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const scrollEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${prev.length}` }])
  }

  const openDraftForm = (result: ReceiptParseResult) => {
    onOpenDraftForm(receiptParseToTransactionDraft(result, currency))
  }

  const handleAiImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    const preview = URL.createObjectURL(file)
    addMessage({
      role: 'user',
      content: `สแกนรูป: ${file.name}`,
      type: 'image',
      imagePreview: preview,
    })

    setParsing(true)
    try {
      const form = new FormData()
      form.append('image', file)

      const res = await fetch('/api/ai/transaction/parse', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Parse failed')
      }

      const result = data.draft as ReceiptParseResult

      addMessage({
        role: 'assistant',
        content: `แยกข้อมูลแล้ว: ${result.description} — ${result.totalAmount} ${result.currency || currency}`,
        type: 'draft',
        draft: result,
      })

      setPendingResult(result)
      setReviewOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'สแกนรูปไม่สำเร็จ')
      addMessage({
        role: 'assistant',
        content: 'ไม่สามารถแยกข้อมูลจากรูปได้ ลองใหม่อีกครั้ง',
        type: 'text',
      })
    } finally {
      setParsing(false)
      URL.revokeObjectURL(preview)
    }
  }

  return (
    <>
      <div className="flex flex-col h-[min(400px,60vh)] border rounded-lg bg-card">
        <div className="flex items-center gap-2 px-4 py-3 border-b">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium text-sm">สแกนใบเสร็จด้วย AI</span>
          <Badge variant="secondary" className="text-[10px]">
            Gemini เท่านั้น
          </Badge>
        </div>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-3 py-4 min-h-[150px]">
            {messages.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                อัปรูปใบเสร็จหรือสลิปโอน — AI จะแยกข้อมูลและเปิดหน้าต่างให้ตรวจสอบก่อนบันทึก
              </p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-3 py-2 text-sm',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {msg.imagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={msg.imagePreview} alt="" className="mb-2 max-h-32 rounded object-cover" />
                  )}
                  <p>{msg.content}</p>
                  {msg.type === 'draft' && msg.draft && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2 w-full"
                      onClick={() => {
                        setPendingResult(msg.draft!)
                        setReviewOpen(true)
                      }}
                    >
                      ดูข้อมูลอีกครั้ง
                    </Button>
                  )}
                </div>
              </div>
            ))}
            <div ref={scrollEndRef} />
          </div>
        </ScrollArea>

        <div className="flex gap-2 p-4 border-t bg-muted/30">
          <input
            ref={aiImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="Upload image for AI parsing"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleAiImage(f)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 flex-1"
            disabled={parsing}
            onClick={() => aiImageInputRef.current?.click()}
          >
            {parsing ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
            สแกนรูปใบเสร็จ
          </Button>
        </div>
      </div>

      <AiReceiptReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={pendingResult}
        defaultCurrency={currency}
        onConfirm={() => pendingResult && openDraftForm(pendingResult)}
      />
    </>
  )
}
