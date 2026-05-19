'use client'

import * as React from 'react'
import {
  ImagePlus, Send, Loader2, Sparkles, Paperclip, Bookmark,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { receiptParseToTripExpenseDraft } from '@/lib/ai/receipt-mapper'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { Trip, TripCurrency, TripExpense, AiTextProvider } from '@/lib/firestore-types'
import { toast } from 'sonner'
import { AiReceiptReviewDialog } from '@/components/ai/ai-receipt-review-dialog'

interface Member {
  key: string
  displayName: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  type: 'text' | 'image' | 'draft'
  draft?: ReceiptParseResult
  imagePreview?: string
}

export interface TripAiPanelProps {
  tripId: string
  trip: Trip
  tripMembers: Member[]
  aiTextProvider: AiTextProvider
  onOpenExpenseForm: (
    draft: Omit<TripExpense, 'id' | 'createdAt' | 'userId' | 'tripId' | 'transactionId'>,
    immichAssetId?: string | null
  ) => void
}

export function TripAiPanel({
  tripId,
  trip,
  tripMembers,
  aiTextProvider,
  onOpenExpenseForm,
}: TripAiPanelProps) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState('')
  const [parsing, setParsing] = React.useState(false)
  const [uploadingNote, setUploadingNote] = React.useState(false)
  const [sendingMessage, setSendingMessage] = React.useState(false)
  const [provider, setProvider] = React.useState<AiTextProvider>(aiTextProvider)
  const [pendingImmichId, setPendingImmichId] = React.useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = React.useState(false)
  const [pendingResult, setPendingResult] = React.useState<ReceiptParseResult | null>(null)

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const noteImageInputRef = React.useRef<HTMLInputElement>(null)
  const scrollEndRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setProvider(aiTextProvider)
  }, [aiTextProvider])

  React.useEffect(() => {
    scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const addMessage = (msg: Omit<ChatMessage, 'id'>) => {
    setMessages((prev) => [...prev, { ...msg, id: `${Date.now()}-${prev.length}` }])
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
      form.append('tripId', tripId)

      const res = await fetch('/api/ai/receipt/parse', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Parse failed')
      }

      const draft = data.draft as ReceiptParseResult
      addMessage({
        role: 'assistant',
        content: `แยกข้อมูลแล้ว: ${draft.description} — ${draft.totalAmount} ${draft.currency || trip.tripCurrency || 'THB'}`,
        type: 'draft',
        draft,
      })
      setPendingResult(draft)
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

  const handleNoteImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    setUploadingNote(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('filename', file.name)

      const res = await fetch('/api/immich/upload', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Upload failed')
      }

      setPendingImmichId(data.assetId)
      addMessage({
        role: 'assistant',
        content: 'อัปโหลดรูปโน้ตถาวรแล้ว — จะแนบเมื่อบันทึกธุรกรรม',
        type: 'text',
      })
      toast.success('เก็บรูปใน Immich แล้ว')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadingNote(false)
    }
  }

  const openDraftForm = (draft: ReceiptParseResult) => {
    const expenseDraft = receiptParseToTripExpenseDraft(
      draft,
      tripMembers,
      (trip.tripCurrency as TripCurrency) || 'THB'
    )
    onOpenExpenseForm(expenseDraft, pendingImmichId)
    setPendingImmichId(null)
  }

  const handleSendText = async () => {
    const text = input.trim()
    if (!text) return

    addMessage({ role: 'user', content: text, type: 'text' })
    setInput('')
    setSendingMessage(true)

    try {
      const res = await fetch('/api/ai/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          provider,
          history: messages.map((m) => ({
            role: m.role,
            content: m.type === 'draft' ? `[รูปใบเสร็จ: ${m.content}]` : m.content,
          })),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Chat failed')
      }

      addMessage({
        role: 'assistant',
        content: data.response,
        type: 'text',
      })
      toast.success(`${provider === 'local' ? 'Local' : 'Gemma'} AI ตอบแล้ว`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'ส่งข้อความไม่สำเร็จ')
      addMessage({
        role: 'assistant',
        content: `ไม่สามารถรับคำตอบจาก ${provider === 'local' ? 'Local' : 'Gemma'} AI ได้ ลองใหม่อีกครั้ง`,
        type: 'text',
      })
    } finally {
      setSendingMessage(false)
    }
  }

  const tripCurrency = (trip.tripCurrency as TripCurrency) || 'THB'

  return (
    <>
    <div className="flex flex-col h-[min(520px,70vh)] border rounded-lg bg-card">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <span className="font-medium text-sm">AI Assistant</span>
          <Badge variant="secondary" className="text-[10px]">
            ข้อความ: {provider === 'local' ? 'Local' : 'Gemma'}
          </Badge>
        </div>
        <Select value={provider} onValueChange={(v) => setProvider(v as AiTextProvider)} disabled={parsing || sendingMessage}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gemma">Gemma API</SelectItem>
            <SelectItem value="local">Local AI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="flex-1 px-4">
        <div className="space-y-3 py-4 min-h-[200px]">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              อัปรูปใบเสร็จ (Gemini) หรือพิมพ์ข้อความ — รูปจะเปิดหน้าต่างให้ตรวจสอบก่อนบันทึก
            </p>
          )}
          {messages.map((msg) => (
            <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-lg px-3 py-2 text-sm', msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
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

      {pendingImmichId && (
        <div className="px-4 py-1">
          <Badge variant="outline" className="text-xs gap-1"><Bookmark className="size-3" /> มีรูปโน้ตรอแนบ</Badge>
        </div>
      )}

      <div className="flex flex-wrap gap-2 px-4 py-2 border-t bg-muted/30">
        <input
          ref={aiImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload image for AI parsing"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAiImage(f); e.target.value = '' }}
        />
        <input
          ref={noteImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="Upload image for note attachment"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleNoteImage(f); e.target.value = '' }}
        />
        <Button type="button" variant="outline" size="sm" className="gap-1" disabled={parsing || sendingMessage} onClick={() => aiImageInputRef.current?.click()}>
          {parsing ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          สแกนรูป (Gemini)
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1" disabled={uploadingNote || sendingMessage} onClick={() => noteImageInputRef.current?.click()}>
          {uploadingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          เก็บโน้ต (Immich)
        </Button>
      </div>

      <div className="flex gap-2 p-4 pt-2 border-t">
        <Textarea placeholder="พิมพ์ข้อความ..." value={input} onChange={(e) => setInput(e.target.value)}
          className="min-h-[44px] max-h-24 resize-none"
          disabled={sendingMessage}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendText() } }} />
        <Button type="button" size="icon" disabled={!input.trim() || parsing || sendingMessage} onClick={handleSendText}>
          {sendingMessage ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>
    </div>

      <AiReceiptReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        result={pendingResult}
        defaultCurrency={tripCurrency}
        onConfirm={() => pendingResult && openDraftForm(pendingResult)}
      />
    </>
  )
}
