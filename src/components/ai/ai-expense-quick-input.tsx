'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Paperclip, Send, Sparkles, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AiTextProvider } from '@/lib/firestore-types'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { toast } from 'sonner'

export interface AiExpenseQuickInputProps {
  tripId?: string
  aiTextProvider?: AiTextProvider
  onParsed: (result: ReceiptParseResult) => void
  onImmichNoteReady?: (assetId: string) => void
  pendingImmichId?: string | null
}

export function AiExpenseQuickInput({
  tripId,
  aiTextProvider = 'gemma',
  onParsed,
  onImmichNoteReady,
  pendingImmichId,
}: AiExpenseQuickInputProps) {
  const [input, setInput] = React.useState('')
  const [parsingText, setParsingText] = React.useState(false)
  const [parsingImage, setParsingImage] = React.useState(false)
  const [uploadingNote, setUploadingNote] = React.useState(false)

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const noteImageInputRef = React.useRef<HTMLInputElement>(null)

  const busy = parsingText || parsingImage || uploadingNote

  const handleParseText = async () => {
    const text = input.trim()
    if (!text) return

    setParsingText(true)
    try {
      const res = await fetch('/api/ai/expense/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text,
          tripId,
          provider: aiTextProvider,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      setInput('')
      onParsed(data.draft as ReceiptParseResult)
      toast.success('แยกข้อมูลแล้ว — ตรวจสอบก่อนบันทึก')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'แยกข้อมูลไม่สำเร็จ')
    } finally {
      setParsingText(false)
    }
  }

  const handleAiImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    setParsingImage(true)
    try {
      const form = new FormData()
      form.append('image', file)

      const endpoint = tripId ? '/api/ai/receipt/parse' : '/api/ai/transaction/parse'
      if (tripId) form.append('tripId', tripId)

      const res = await fetch(endpoint, { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      onParsed(data.draft as ReceiptParseResult)
      toast.success('แยกข้อมูลจากรูปแล้ว — ตรวจสอบก่อนบันทึก')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'สแกนรูปไม่สำเร็จ')
    } finally {
      setParsingImage(false)
    }
  }

  const handleNoteImage = async (file: File) => {
    if (!file.type.startsWith('image/') || !onImmichNoteReady) return

    setUploadingNote(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('filename', file.name)

      const res = await fetch('/api/immich/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')

      onImmichNoteReady(data.assetId)
      toast.success('เก็บรูปโน้ตแล้ว — จะแนบเมื่อบันทึก')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadingNote(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">เพิ่มรายจ่ายด้วย AI</p>
          <p className="text-xs text-muted-foreground truncate">
            พิมพ์หรืออัปรูป → ตรวจสอบ → กรอกฟอร์ม
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] shrink-0 ml-auto">
          รูป: Gemini
        </Badge>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder='เช่น "ไก่ทอด 20" หรือ "ไก่ทอด 20 กาแฟ 45"'
          value={input}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleParseText()
            }
          }}
          className="h-9"
        />
        <Button
          type="button"
          size="icon"
          className="shrink-0 size-9"
          disabled={!input.trim() || busy}
          onClick={handleParseText}
          aria-label="แยกข้อมูลจากข้อความ"
        >
          {parsingText ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={aiImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="อัปรูปใบเสร็จ"
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
          className="gap-1 h-8"
          disabled={busy}
          onClick={() => aiImageInputRef.current?.click()}
        >
          {parsingImage ? <Loader2 className="size-3.5 animate-spin" /> : <ImagePlus className="size-3.5" />}
          อัปรูปใบเสร็จ
        </Button>

        {onImmichNoteReady && (
          <>
            <input
              ref={noteImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              aria-label="เก็บรูปโน้ต"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleNoteImage(f)
                e.target.value = ''
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1 h-8"
              disabled={busy}
              onClick={() => noteImageInputRef.current?.click()}
            >
              {uploadingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
              เก็บโน้ต
            </Button>
          </>
        )}
      </div>

      {pendingImmichId && (
        <Badge variant="outline" className="text-xs gap-1 w-fit">
          <Bookmark className="size-3" />
          มีรูปโน้ตรอแนบ
        </Badge>
      )}

      <p className="text-[10px] text-muted-foreground">
        ข้อความ: {aiTextProvider === 'local' ? 'Local AI' : 'Gemma'} · ไม่มีแชท — แยกข้อมูลแล้วเปิดฟอร์มให้กรอก
      </p>
    </div>
  )
}
