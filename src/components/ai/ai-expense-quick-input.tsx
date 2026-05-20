'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Paperclip, Send, Sparkles, Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AiTextProvider } from '@/lib/firestore-types'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import { toast } from 'sonner'

export interface AiExpenseQuickInputProps {
  tripId?: string
  aiTextProvider?: AiTextProvider
  /** แสดงตัวเลือก Local / Gemini สำหรับทั้งข้อความและรูปใบเสร็จ */
  showTextProviderSelect?: boolean
  onParsed: (result: ReceiptParseResult) => void
  onImmichNoteReady?: (assetId: string) => void
  pendingImmichCount?: number
}

export function AiExpenseQuickInput({
  tripId,
  aiTextProvider = 'gemma',
  showTextProviderSelect = true,
  onParsed,
  onImmichNoteReady,
  pendingImmichCount = 0,
}: AiExpenseQuickInputProps) {
  const [input, setInput] = React.useState('')
  const [textProvider, setTextProvider] = React.useState<AiTextProvider>(aiTextProvider)
  const [parsingText, setParsingText] = React.useState(false)
  const [parsingImage, setParsingImage] = React.useState(false)
  const [uploadingNote, setUploadingNote] = React.useState(false)

  const [pendingReceiptFile, setPendingReceiptFile] = React.useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = React.useState<string | null>(null)
  const [receiptExtraInstructions, setReceiptExtraInstructions] = React.useState('')

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const noteImageInputRef = React.useRef<HTMLInputElement>(null)

  const busy = parsingText || parsingImage || uploadingNote
  const receiptMode = !!pendingReceiptFile

  React.useEffect(() => {
    setTextProvider(aiTextProvider)
  }, [aiTextProvider])

  React.useEffect(() => {
    if (!pendingReceiptFile) {
      setReceiptPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingReceiptFile)
    setReceiptPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingReceiptFile])

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
          provider: textProvider,
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

  const runReceiptAnalysis = async () => {
    if (!pendingReceiptFile) {
      toast.error('กรุณาเลือกรูปใบเสร็จก่อน')
      return
    }

    setParsingImage(true)
    try {
      const form = new FormData()
      form.append('image', pendingReceiptFile)
      if (tripId) form.append('tripId', tripId)
      form.append('provider', textProvider)
      if (receiptExtraInstructions.trim()) {
        form.append('extraInstructions', receiptExtraInstructions.trim())
      }

      const endpoint = tripId ? '/api/ai/receipt/parse' : '/api/ai/transaction/parse'

      const res = await fetch(endpoint, { method: 'POST', body: form, credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      onParsed(data.draft as ReceiptParseResult)
      setPendingReceiptFile(null)
      setReceiptExtraInstructions('')
      toast.success('แยกข้อมูลจากรูปแล้ว — ตรวจสอบก่อนบันทึก')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'สแกนรูปไม่สำเร็จ')
    } finally {
      setParsingImage(false)
    }
  }

  const handlePrimarySend = () => {
    if (receiptMode) {
      void runReceiptAnalysis()
    } else {
      void handleParseText()
    }
  }

  const handleNoteImage = async (file: File) => {
    if (!file.type.startsWith('image/') || !onImmichNoteReady) return

    setUploadingNote(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('filename', file.name)
      if (tripId) form.append('tripId', tripId)

      const res = await fetch('/api/immich/upload', { method: 'POST', body: form, credentials: 'same-origin' })
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

  const imageProviderLabel = textProvider === 'local' ? 'Local AI' : 'Gemini'

  const primaryDisabled = receiptMode
    ? busy || !pendingReceiptFile || parsingImage
    : busy || !input.trim() || parsingText

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">เพิ่มรายจ่ายด้วย AI</p>
          <p className="text-xs text-muted-foreground truncate">
            {receiptMode
              ? 'พิมพ์คำสั่งเพิ่มเติม (ไม่บังคับ) แล้วกดส่งเพื่อวิเคราะห์รูป'
              : 'พิมพ์รายการหรือเลือกรูปใบเสร็จด้านล่าง → กดส่ง'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {showTextProviderSelect && (
            <Select
              value={textProvider}
              onValueChange={(v) => setTextProvider(v as AiTextProvider)}
              disabled={busy}
            >
              <SelectTrigger className="h-7 w-[118px] text-[10px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local AI</SelectItem>
                <SelectItem value="gemma">Gemini</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Badge variant="secondary" className="text-[10px]">
            รูป: {imageProviderLabel}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 items-start">
        {receiptMode ? (
          <Textarea
            placeholder="คำสั่งเพิ่มเติม (ไม่บังคับ) เช่น แปลชื่อสินค้าเป็นภาษาไทย, ผู้จ่ายคือใคร..."
            value={receiptExtraInstructions}
            disabled={busy}
            onChange={(e) => setReceiptExtraInstructions(e.target.value)}
            className="min-h-[72px] text-sm resize-y flex-1"
            aria-label="คำสั่งเพิ่มเติมสำหรับวิเคราะห์ใบเสร็จ"
          />
        ) : (
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
            className="h-9 flex-1"
          />
        )}
        <Button
          type="button"
          size="icon"
          className="shrink-0 size-9 mt-0.5"
          disabled={primaryDisabled}
          onClick={handlePrimarySend}
          aria-label={receiptMode ? 'ส่งวิเคราะห์รูปใบเสร็จ' : 'แยกข้อมูลจากข้อความ'}
        >
          {receiptMode ? (
            parsingImage ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />
          ) : (
            parsingText ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />
          )}
        </Button>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/30 p-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">รูปใบเสร็จ</p>
        <div className="flex flex-wrap gap-2 items-center">
          <input
            ref={aiImageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            aria-label="เลือกรูปใบเสร็จ"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) {
                if (!f.type.startsWith('image/')) {
                  toast.error('กรุณาเลือกไฟล์รูปภาพ')
                } else {
                  setPendingReceiptFile(f)
                }
              }
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
            <ImagePlus className="size-3.5" />
            เลือกรูป
          </Button>
          {pendingReceiptFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              disabled={busy}
              onClick={() => {
                setPendingReceiptFile(null)
                setReceiptExtraInstructions('')
              }}
            >
              ล้างรูป
            </Button>
          )}
        </div>
        {receiptPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={receiptPreviewUrl}
            alt="ตัวอย่างใบเสร็จ"
            className="max-h-32 rounded-md border object-contain"
          />
        )}
      </div>

      <div className="flex flex-wrap gap-2">
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
              เก็บโน้ต (Immich)
            </Button>
          </>
        )}
      </div>

      {pendingImmichCount > 0 && (
        <Badge variant="outline" className="text-xs gap-1 w-fit">
          <Bookmark className="size-3" />
          มีรูปโน้ตรอแนบ ({pendingImmichCount})
        </Badge>
      )}

      <p className="text-[10px] text-muted-foreground">
        ข้อความสั้นแยกทันที · ข้อความ/รูปซับซ้อนใช้{' '}
        {textProvider === 'local' ? 'Local AI' : 'Gemini'}
        {textProvider === 'local' ? ' (ข้อความล้มแล้วลอง Gemini)' : ''}
      </p>
    </div>
  )
}
