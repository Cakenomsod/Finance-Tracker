'use client'

import * as React from 'react'
import { ImagePlus, Loader2, Paperclip, Send, Sparkles, Bookmark, CheckCircle2, AlertCircle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'
import {
  AiParseJob,
  createAiParseJob,
  loadAiParseJobs,
  saveAiParseJobs,
} from '@/lib/ai/parse-jobs-storage'
import { readApiJson } from '@/lib/api-json'
import { authFetch } from '@/lib/api-auth-client'
import { compressImageForUpload } from '@/lib/immich/compress-image'
import { uploadAttachmentImage } from '@/lib/immich/upload-client'
import { useImmichUploadDelivery } from '@/providers/immich-upload-context'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { AI_INPUT_ID } from '@/components/quick-add-context'
import { useLocale } from '@/components/locale-provider'

/** Server/model errors are not actionable for users; keep only messages we wrote ourselves. */
function friendlyAiError(err: unknown, fallback: string): string {
  const message = err instanceof Error ? err.message : ''
  if (!message || /[a-z]{3,}/i.test(message) && !/[\u0E00-\u0E7F]/.test(message)) return fallback
  return message
}

export interface AiExpenseQuickInputProps {
  tripId?: string
  /** localStorage scope for persisting parse jobs */
  storageScope: string
  /** เรียกเมื่อผู้ใช้กดตรวจสอบ/แก้ไขจาก job ที่เสร็จแล้ว */
  onReview?: (result: ReceiptParseResult, immichIds: string[], jobId: string) => void
  pendingImmichIds?: string[]
  onImmichNoteReady?: (assetId: string) => void
  /** Called with the snapshot of pending Immich IDs consumed when a new job is created */
  onConsumePendingImmichIds?: (ids: string[]) => void
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
    onReview,
    pendingImmichIds = [],
    onImmichNoteReady,
    onConsumePendingImmichIds,
  },
  ref
) {
  const { p } = useLocale()
  const [input, setInput] = React.useState('')
  const [jobs, setJobs] = React.useState<AiParseJob[]>(() => loadAiParseJobs(storageScope))
  const skipSaveRef = React.useRef(true)

  const [pendingReceiptFile, setPendingReceiptFile] = React.useState<File | null>(null)
  const [receiptPreviewUrl, setReceiptPreviewUrl] = React.useState<string | null>(null)
  const [receiptExtraInstructions, setReceiptExtraInstructions] = React.useState('')

  const aiImageInputRef = React.useRef<HTMLInputElement>(null)
  const noteImageInputRef = React.useRef<HTMLInputElement>(null)
  const pendingImmichRef = React.useRef(pendingImmichIds)
  pendingImmichRef.current = pendingImmichIds
  const onImmichNoteReadyRef = React.useRef(onImmichNoteReady)
  onImmichNoteReadyRef.current = onImmichNoteReady
  const onConsumePendingImmichIdsRef = React.useRef(onConsumePendingImmichIds)
  onConsumePendingImmichIdsRef.current = onConsumePendingImmichIds

  const noteDeliveryKey = `ai-notes:${storageScope}`
  const { enqueue: enqueueNoteUpload, uploadingCount: uploadingNoteCount } =
    useImmichUploadDelivery(noteDeliveryKey, (assetId) => {
      onImmichNoteReadyRef.current?.(assetId)
    })

  const receiptMode = !!pendingReceiptFile
  const activeJobCount = jobs.filter((j) => j.status === 'processing').length

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
      const res = await authFetch('/api/ai/expense/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          tripId,
          provider: job.provider,
        }),
      })
      const data = await readApiJson<{
        error?: string
        draft?: ReceiptParseResult
        drafts?: ReceiptParseResult[]
      }>(res)
      if (!res.ok) throw new Error(data.error || 'Parse failed')

      const drafts = data.drafts?.length
        ? data.drafts
        : data.draft
          ? [data.draft]
          : []

      if (drafts.length === 0) throw new Error('No drafts returned from AI')

      if (drafts.length === 1) {
        updateJob(job.id, { status: 'done', result: drafts[0] })
      } else {
        // Replace original placeholder job with one done-job per draft
        setJobs((prev) => {
          const without = prev.filter((j) => j.id !== job.id)
          const newJobs = drafts.map((d, i) =>
            Object.assign(
              createAiParseJob({
                provider: job.provider,
                kind: 'text',
                inputLabel: d.description || `รายการ ${i + 1}`,
                // Only first draft inherits the note immich ids
                immichIds: i === 0 ? job.immichIds : [],
              }),
              { status: 'done' as const, result: d }
            )
          )
          return [...newJobs, ...without]
        })
      }

      toast.success(
        drafts.length > 1
          ? `แยกได้ ${drafts.length} รายการ — กดตรวจสอบทีละรายการเพื่อบันทึก`
          : 'แยกรายการเสร็จแล้ว — กดตรวจสอบเพื่อบันทึก'
      )
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: friendlyAiError(err, 'อ่านข้อความไม่ออก ลองพิมพ์แบบ "ข้าว 45" หรือจดเองด้วยปุ่ม +'),
      })
    }
  }

  const runReceiptJob = async (
    job: AiParseJob,
    file: File,
    extraInstructions: string
  ) => {
    try {
      // Compress client-side first — full phone photos + Immich on a low-memory
      // SSR instance regularly OOM into HTTP 500 when both run uncompressed.
      const prepared = await compressImageForUpload(file)

      // Upload + AI parse in parallel; bind Immich asset only to THIS job.
      const form = new FormData()
      form.append('image', prepared)
      if (tripId) form.append('tripId', tripId)
      form.append('provider', job.provider)
      if (extraInstructions.trim()) {
        form.append('extraInstructions', extraInstructions.trim())
      }

      const endpoint = tripId ? '/api/ai/receipt/parse' : '/api/ai/transaction/parse'

      const [uploadResult, parseRes] = await Promise.all([
        uploadAttachmentImage(prepared, { tripId, compress: false }).catch(() => null),
        authFetch(endpoint, { method: 'POST', body: form }),
      ])

      const data = await readApiJson<{ error?: string; draft?: ReceiptParseResult }>(parseRes)
      if (!parseRes.ok) throw new Error(data.error || 'Parse failed')

      const boundIds = uploadResult?.assetId
        ? [...new Set([...job.immichIds, uploadResult.assetId])]
        : job.immichIds

      updateJob(job.id, {
        status: 'done',
        result: data.draft as ReceiptParseResult,
        immichIds: boundIds,
      })
      toast.success(
        uploadResult?.assetId
          ? 'อ่านใบเสร็จเสร็จแล้ว (แนบรูปไว้ให้) — กดตรวจสอบเพื่อบันทึก'
          : 'อ่านใบเสร็จเสร็จแล้ว — กดตรวจสอบเพื่อบันทึก'
      )
    } catch (err) {
      updateJob(job.id, {
        status: 'error',
        error: friendlyAiError(err, 'อ่านใบเสร็จไม่ออก ลองถ่ายให้ชัดขึ้น หรือจดเองด้วยปุ่ม +'),
      })
    }
  }

  const enqueueTextParse = (text: string) => {
    // Snapshot pending ids NOW so they belong exclusively to this job
    const snapshotIds = [...pendingImmichRef.current]
    const job = createAiParseJob({
      provider: 'gemma',
      kind: 'text',
      inputLabel: text.length > 80 ? `${text.slice(0, 80)}…` : text,
      immichIds: snapshotIds,
    })
    setJobs((prev) => [job, ...prev])
    setInput('')
    if (snapshotIds.length > 0) {
      onConsumePendingImmichIdsRef.current?.(snapshotIds)
    }
    void runTextJob(job, text)
  }

  const enqueueReceiptParse = (file: File, extraInstructions: string) => {
    // Snapshot note pending ids — receipt will get its own immich id from upload
    const snapshotIds = [...pendingImmichRef.current]
    const job = createAiParseJob({
      provider: 'gemma',
      kind: 'receipt',
      inputLabel: file.name || 'รูปใบเสร็จ',
      immichIds: snapshotIds,
    })
    setJobs((prev) => [job, ...prev])
    setPendingReceiptFile(null)
    setReceiptExtraInstructions('')
    if (snapshotIds.length > 0) {
      onConsumePendingImmichIdsRef.current?.(snapshotIds)
    }
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

  const handleNoteImage = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    enqueueNoteUpload(file, {
      tripId,
      label: file.name || 'รูปโน้ต',
      successToast: 'เก็บรูปโน้ตแล้ว — จะแนบเมื่อบันทึก',
    })
  }

  const primaryDisabled = receiptMode ? !pendingReceiptFile : !input.trim()

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
          <Sparkles className="size-4 text-primary" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">
            {p({ th: 'ให้ AI จดให้', en: 'Let AI log it', zh: '让 AI 记账' })}
          </p>
          <p className="text-xs text-muted-foreground">
            {p({
              th: 'พิมพ์หลายรายการพร้อมกัน หรือแนบรูปใบเสร็จ',
              en: 'Type several items at once, or attach a receipt',
              zh: '一次输入多笔，或附上收据',
            })}
          </p>
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
          <Textarea
            id={storageScope === 'transactions' ? AI_INPUT_ID : undefined}
            placeholder={'เช่น "ไก่ทอด 20" หรือวางหลายบรรทัด:\nนั่งวิน 10\nข้าว 45\nทั้งหมดนี้วันที่ 25 สิงหา 69\n(Ctrl+Enter เพื่อส่ง)'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault()
                if (!primaryDisabled) handlePrimarySend()
              }
            }}
            className="min-h-[80px] text-sm resize-y flex-1"
            aria-label="พิมพ์รายการค่าใช้จ่าย"
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

      <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
        <p className="text-xs font-medium text-muted-foreground">
          {p({ th: 'รูปใบเสร็จ', en: 'Receipt photo', zh: '收据照片' })}
        </p>
        <p className="text-xs text-muted-foreground">
          {p({
            th: 'เลือกรูปแล้วกดส่ง AI จะอ่านยอดและรายการให้ พร้อมแนบรูปไว้กับรายการ',
            en: 'Pick a photo and send — AI reads the total and items and attaches the photo',
            zh: '选择照片并发送，AI 会识别金额和明细并附上照片',
          })}
        </p>
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
            className="gap-1 h-9"
            onClick={() => aiImageInputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" aria-hidden />
            {p({ th: 'เลือกรูป', en: 'Choose photo', zh: '选择照片' })}
          </Button>
          {pendingReceiptFile && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-9 text-xs"
              onClick={() => {
                setPendingReceiptFile(null)
                setReceiptExtraInstructions('')
              }}
            >
              {p({ th: 'ล้างรูป', en: 'Remove photo', zh: '移除照片' })}
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
          multiple
          className="hidden"
          aria-label="แนบรูปประกอบ"
          onChange={(e) => {
            const files = e.target.files
            if (files?.length) {
              Array.from(files).forEach((f) => handleNoteImage(f))
            }
            e.target.value = ''
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1 h-9"
          onClick={() => noteImageInputRef.current?.click()}
        >
          {uploadingNoteCount > 0 ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="size-3.5" aria-hidden />
          )}
          {p({ th: 'แนบรูปประกอบ', en: 'Attach a photo', zh: '附加照片' })}
          {uploadingNoteCount > 0 ? ` · ${uploadingNoteCount}` : ''}
        </Button>
      </div>

      {uploadingNoteCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {p({
            th: 'กำลังอัปโหลดรูปเบื้องหลัง — พิมพ์ต่อหรือไปทำอย่างอื่นได้',
            en: 'Uploading in the background — keep typing or move on',
            zh: '正在后台上传，可继续输入',
          })}
        </p>
      )}

      {pendingImmichIds.length > 0 && (
        <Badge variant="outline" className="text-xs gap-1 w-fit">
          <Bookmark className="size-3" aria-hidden />
          {p({
            th: `รูปรอแนบกับรายการถัดไป (${pendingImmichIds.length})`,
            en: `Photos waiting for the next entry (${pendingImmichIds.length})`,
            zh: `待附加到下一笔的照片（${pendingImmichIds.length}）`,
          })}
        </Badge>
      )}

      {jobs.length > 0 && (
        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">
            {p({ th: 'รายการที่ AI กำลังอ่าน', en: 'AI results', zh: 'AI 识别结果' })}
            {activeJobCount > 0 && (
              <span className="tabular-nums">
                {p({
                  th: ` (กำลังอ่าน ${activeJobCount})`,
                  en: ` (${activeJobCount} in progress)`,
                  zh: `（${activeJobCount} 个处理中）`,
                })}
              </span>
            )}
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {jobs.map((job) => (
              <div
                key={job.id}
                className={cn(
                  'space-y-2 rounded-md border px-3 py-2 text-xs transition-colors duration-200',
                  job.status === 'error' && 'border-destructive/40 bg-destructive/5',
                  job.status === 'done' && 'border-primary/30 bg-primary/5'
                )}
              >
                <div className="flex items-start gap-2">
                  {job.status === 'processing' && (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
                  )}
                  {job.status === 'done' && (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  )}
                  {job.status === 'error' && (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{job.inputLabel}</p>
                    <p className="text-muted-foreground">
                      {job.kind === 'receipt'
                        ? p({ th: 'ใบเสร็จ', en: 'Receipt', zh: '收据' })
                        : p({ th: 'ข้อความ', en: 'Text', zh: '文字' })}{' '}
                      · {statusLabel(job)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    onClick={() => removeJob(job.id)}
                    aria-label={p({ th: 'ปิดรายการนี้', en: 'Dismiss', zh: '关闭' })}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                {job.status === 'done' && job.result && onReview && (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 w-full text-sm"
                    onClick={() => onReview(job.result!, job.immichIds, job.id)}
                  >
                    {p({ th: 'ตรวจสอบแล้วบันทึก', en: 'Review & save', zh: '检查并保存' })}
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
