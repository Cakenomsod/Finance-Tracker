'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Paperclip, Send, Sparkles, Bookmark, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { AiTextProvider } from '@/lib/firestore-types'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import {
  AiParseJob,
  createAiParseJob,
  loadAiParseJobs,
  saveAiParseJobs,
} from '@/lib/ai/parse-jobs-storage'
import { readApiJson } from '@/lib/api-json'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface AiExpenseQuickInputProps {
  tripId?: string
  /** localStorage scope for persisting parse jobs */
  storageScope: string
  aiTextProvider?: AiTextProvider
  /** แสดงตัวเลือก Local / Gemini สำหรับทั้งข้อความและรูปใบเสร็จ */
  showTextProviderSelect?: boolean
  /** เรียกเมื่อผู้ใช้กดตรวจสอบ/แก้ไขจาก job ที่เสร็จแล้ว */
  onReview?: (result: ReceiptParseResult, immichIds: string[], jobId: string) => void
  pendingImmichIds?: string[]
  onImmichNoteReady?: (assetId: string) => void
}

function providerLabel(p: AiTextProvider) {
  return p === 'local' ? 'Local AI' : 'Gemini'
}

function statusLabel(job: AiParseJob) {
  if (job.status === 'processing') return 'กำลังแยกรายการ...'
  if (job.status === 'done') return 'แยกเสร็จแล้ว'
  return job.error || 'แยกไม่สำเร็จ'
}

export interface AiExpenseQuickInputHandle {
  completeJob: (jobId: string) => void
}

export const AiExpenseQuickInput = React.forwardRef<
  AiExpenseQuickInputHandle,
  AiExpenseQuickInputProps
>(function AiExpenseQuickInput(
  {
    tripId,
    storageScope,
    aiTextProvider = 'gemma',
    showTextProviderSelect = true,
    onReview,
    pendingImmichIds = [],
    onImmichNoteReady,
  },
  ref
) {
  const [input, setInput] = React.useState('')
  const [textProvider, setTextProvider] = React.useState<AiTextProvider>(aiTextProvider)
  const [uploadingNote, setUploadingNote] = React.useState(false)
  const [jobs, setJobs] = React.useState<AiParseJob[]>(() => loadAiParseJobs(storageScope))
  const skipSaveRef = React.useRef(true)

  const [pendingReceiptFile, setPendingReceiptFile] = React.useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = React.useState<string | null>(null)
  const [receiptExtraInstructions, setReceiptExtraInstructions] = React.useState('')

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const noteImageInputRef = React.useRef<HTMLInputElement>(null)
  const pendingImmichRef = React.useRef(pendingImmichIds)
  pendingImmichRef.current = pendingImmichIds

  const receiptMode = !!pendingReceiptFile
  const activeJobCount = jobs.filter((j) => j.status === 'processing').length

  React.useEffect(() => {
    setTextProvider(aiTextProvider)
  }, [aiTextProvider])

  React.useEffect(() => {
    setJobs(loadAiParseJobs(storageScope))
    skipSaveRef.current = true
  }, [storageScope])

  React.useEffect(() => {
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }
    saveAiParseJobs(storageScope, jobs)
  }, [jobs, storageScope])

  React.useEffect(() => {
    if (!pendingReceiptFile) {
      setReceiptPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pendingReceiptFile)
    setReceiptPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pendingReceiptFile])

  const updateJob = React.useCallback((id: string, patch: Partial<AiParseJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...patch } : j)))
  }, [])

  const removeJob = React.useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }, [])

  React.useImperativeHandle(
    ref,
    () => ({
      completeJob: (jobId: string) => removeJob(jobId),
    }),
    [removeJob]
  )

  const runTextJob = async (job: AiParseJob, text: string) => {
    try {
      const res = await fetch('/api/ai/expense/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          text,
          tripId,
          provider: job.provider,
        }),
      })
      const data = await readApiJson<{ error?: string; draft?: ReceiptParseResult }>(res)
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      updateJob(job.id, { status: 'done', result: data.draft as ReceiptParseResult })
      toast.success('แยกรายการเสร็จแล้ว — กดตรวจสอบ/แก้ไข')
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'แยกข้อมูลไม่สำเร็จ',
      })
    }
  }

  const runReceiptJob = async (
    job: AiParseJob,
    file: File,
    extraInstructions: string
  ) => {
    try {
      const form = new FormData()
      form.append('image', file)
      if (tripId) form.append('tripId', tripId)
      form.append('provider', job.provider)
      if (extraInstructions.trim()) {
        form.append('extraInstructions', extraInstructions.trim())
      }

      const endpoint = tripId ? '/api/ai/receipt/parse' : '/api/ai/transaction/parse'

      const res = await fetch(endpoint, { method: 'POST', body: form, credentials: 'same-origin' })
      const data = await readApiJson<{ error?: string; draft?: ReceiptParseResult }>(res)
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      updateJob(job.id, { status: 'done', result: data.draft as ReceiptParseResult })
      toast.success('แยกรายการจากรูปเสร็จแล้ว — กดตรวจสอบ/แก้ไข')
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: err instanceof Error ? err.message : 'สแกนรูปไม่สำเร็จ',
      })
    }
  }

  const enqueueTextParse = (text: string) => {
    const job = createAiParseJob({
      provider: textProvider,
      kind: 'text',
      inputLabel: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      immichIds: [...pendingImmichRef.current],
    })
    setJobs((prev) => [job, ...prev])
    setInput('')
    void runTextJob(job, text)
  }

  const enqueueReceiptParse = (file: File, extraInstructions: string) => {
    const job = createAiParseJob({
      provider: textProvider,
      kind: 'receipt',
      inputLabel: file.name || 'รูปใบเสร็จ',
      immichIds: [...pendingImmichRef.current],
    })
    setJobs((prev) => [job, ...prev])
    setPendingReceiptFile(null)
    setReceiptExtraInstructions('')
    void runReceiptJob(job, file, extraInstructions)
  }

  const handlePrimarySend = () => {
    if (receiptMode) {
      if (!pendingReceiptFile) {
        toast.error('กรุณาเลือกรูปใบเสร็จก่อน')
        return
      }
      enqueueReceiptParse(pendingReceiptFile, receiptExtraInstructions)
    } else {
      const text = input.trim()
      if (!text) return
      enqueueTextParse(text)
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
      if (tripId) form.append('tripId', tripId)

      const res = await fetch('/api/immich/upload', { method: 'POST', body: form, credentials: 'same-origin' })
      const data = await readApiJson<{ error?: string; assetId?: string }>(res)
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      if (!data.assetId) throw new Error('Upload succeeded but no asset ID returned')

      if (onImmichNoteReady) {
        onImmichNoteReady(data.assetId)
      }
      toast.success('เก็บรูปโน้ตแล้ว — จะแนบเมื่อบันทึก')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'อัปโหลดไม่สำเร็จ')
    } finally {
      setUploadingNote(false)
    }
  }

  const primaryDisabled = receiptMode
    ? !pendingReceiptFile || uploadingNote
    : !input.trim() || uploadingNote

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-primary shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium">เพิ่มรายจ่ายด้วย AI</p>

        </div>
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {showTextProviderSelect && (
            <Select
              value={textProvider}
              onValueChange={(v) => setTextProvider(v as AiTextProvider)}
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
            {providerLabel(textProvider)}
          </Badge>
        </div>
      </div>

      <div className="flex gap-2 items-start">
        {receiptMode ? (
          <Textarea
            placeholder="คำสั่งเพิ่มเติม (ไม่บังคับ) เช่น แปลชื่อสินค้าเป็นภาษาไทย..."
            value={receiptExtraInstructions}
            onChange={(e) => setReceiptExtraInstructions(e.target.value)}
            className="min-h-[72px] text-sm resize-y flex-1"
            aria-label="คำสั่งเพิ่มเติมสำหรับวิเคราะห์ใบเสร็จ"
          />
        ) : (
          <Input
            placeholder='เช่น "ไก่ทอด 20" หรือ "ไก่ทอด 20 กาแฟ 45"'
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (!primaryDisabled) handlePrimarySend()
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
          <Send className="size-4" />
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
        <input
          ref={noteImageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          aria-label="เก็บรูปโน้ต Immich"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void handleNoteImage(f)
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 h-8"
          disabled={uploadingNote}
          onClick={() => noteImageInputRef.current?.click()}
        >
          {uploadingNote ? <Loader2 className="size-3.5 animate-spin" /> : <Paperclip className="size-3.5" />}
          เก็บโน้ต (Immich)
        </Button>
      </div>

      {pendingImmichIds.length > 0 && (
        <Badge variant="outline" className="text-xs gap-1 w-fit">
          <Bookmark className="size-3" />
          มีรูปโน้ตรอแนบ ({pendingImmichIds.length})
        </Badge>
      )}

      {jobs.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
            สถานะการแยกรายการ
            {activeJobCount > 0 && ` (${activeJobCount} กำลังทำ)`}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={cn(
                  'rounded-md border px-3 py-2 text-xs space-y-2',
                  job.status === 'error' && 'border-destructive/40 bg-destructive/5',
                  job.status === 'done' && 'border-primary/30 bg-primary/5'
                )}
              >
                <div className="flex items-start gap-2">
                  {job.status === 'processing' && (
                    <Loader2 className="size-3.5 shrink-0 animate-spin text-primary mt-0.5" />
                  )}
                  {job.status === 'done' && (
                    <CheckCircle2 className="size-3.5 shrink-0 text-primary mt-0.5" />
                  )}
                  {job.status === 'error' && (
                    <AlertCircle className="size-3.5 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{job.inputLabel}</p>
                    <p className="text-muted-foreground">
                      {job.kind === 'receipt' ? 'รูปใบเสร็จ' : 'ข้อความ'} · {providerLabel(job.provider)} · {statusLabel(job)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                    onClick={() => removeJob(job.id)}
                    aria-label="ลบรายการสถานะ"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                {job.status === 'done' && job.result && onReview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 w-full text-xs"
                    onClick={() => onReview(job.result!, job.immichIds, job.id)}
                  >
                    ตรวจสอบ / แก้ไข
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
})
