'use client'

import * as React from 'react'
import { ImagePlus, X, Maximize2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser'
import { useImmichUploadDelivery } from '@/providers/immich-upload-context'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ImmichAttachmentsFieldProps {
  value: string[]
  onChange: (ids: string[]) => void
  /** Passed through for trip membership auth on upload; assets go to the user's Immich album */
  tripId?: string | null
  /** Stable key so late uploads still attach after remount/navigation */
  deliveryKey?: string
  emptyHint?: string
  className?: string
}

type LocalPreview = {
  jobId: string
  url: string
  name: string
}

export function ImmichAttachmentsField({
  value,
  onChange,
  tripId,
  deliveryKey: deliveryKeyProp,
  emptyHint = 'ไม่มีรูป — กด เพิ่มรูป หรือใช้ AI แนบโน้ต',
  className,
}: ImmichAttachmentsFieldProps) {
  const reactId = React.useId()
  const deliveryKey = deliveryKeyProp ?? `attachments:${reactId}`
  const valueRef = React.useRef(value)
  valueRef.current = value

  const [lightboxAssetId, setLightboxAssetId] = React.useState<string | null>(null)
  const [localPreviews, setLocalPreviews] = React.useState<LocalPreview[]>([])
  const attachInputRef = React.useRef<HTMLInputElement>(null)

  const { enqueue, jobs, uploadingCount } = useImmichUploadDelivery(
    deliveryKey,
    (assetId) => {
      onChange([...new Set([...valueRef.current, assetId])])
    }
  )

  // Drop local previews only after their upload job finishes (not while the job is still enqueueing).
  React.useEffect(() => {
    if (localPreviews.length === 0) return
    setLocalPreviews((prev) => {
      const next: LocalPreview[] = []
      for (const p of prev) {
        const job = jobs.find((j) => j.id === p.jobId)
        if (job && (job.status === 'done' || job.status === 'error')) {
          URL.revokeObjectURL(p.url)
          continue
        }
        next.push(p)
      }
      return next.length === prev.length ? prev : next
    })
  }, [jobs, localPreviews.length])

  const previewUrlsOnUnmount = React.useRef(localPreviews)
  previewUrlsOnUnmount.current = localPreviews
  React.useEffect(() => {
    return () => {
      for (const p of previewUrlsOnUnmount.current) {
        URL.revokeObjectURL(p.url)
      }
    }
  }, [])

  const uniqueIds = React.useMemo(() => [...new Set(value)], [value])

  const handleAddFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      toast.error('กรุณาเลือกไฟล์รูปภาพ')
      return
    }

    for (const file of list) {
      const url = URL.createObjectURL(file)
      const jobId = enqueue(file, {
        tripId,
        label: file.name,
        successToast: 'เพิ่มรูปโน้ตแล้ว',
      })
      if (jobId) {
        setLocalPreviews((prev) => [...prev, { jobId, url, name: file.name }])
      } else {
        // Fallback path without provider — no job id; keep short-lived preview.
        const fallbackId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        setLocalPreviews((prev) => [...prev, { jobId: fallbackId, url, name: file.name }])
        window.setTimeout(() => {
          setLocalPreviews((prev) => {
            const target = prev.find((p) => p.jobId === fallbackId)
            if (target) URL.revokeObjectURL(target.url)
            return prev.filter((p) => p.jobId !== fallbackId)
          })
        }, 15_000)
      }
    }
  }

  const handleRemoveAttachment = async (id: string) => {
    await requestDeleteImmichAssets([id])
    onChange(value.filter((x) => x !== id))
  }

  const showEmpty = uniqueIds.length === 0 && localPreviews.length === 0

  return (
    <>
      <div className={cn('rounded-lg border bg-muted/40 p-3 space-y-3', className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            รูปโน้ต (Immich)
            {uploadingCount > 0 ? ` · กำลังอัปโหลด ${uploadingCount}` : ''}
          </p>
          <input
            ref={attachInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) handleAddFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => attachInputRef.current?.click()}
          >
            <ImagePlus className="size-3.5" /> เพิ่มรูป
          </Button>
        </div>
        {showEmpty ? (
          <p className="text-[11px] text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {localPreviews.map((p) => (
              <div
                key={p.jobId}
                className="relative w-20 h-20 rounded-md border bg-background overflow-hidden shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="w-full h-full object-cover opacity-70" />
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              </div>
            ))}
            {uniqueIds.map((id) => (
              <div
                key={id}
                className="relative group w-20 h-20 rounded-md border bg-background overflow-hidden shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/immich/asset/${id}?type=thumbnail`}
                  alt=""
                  className="w-full h-full object-cover cursor-pointer"
                  onClick={() => setLightboxAssetId(id)}
                />
                <button
                  type="button"
                  className="absolute top-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemoveAttachment(id)}
                  aria-label="ลบรูป"
                >
                  <X className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="absolute bottom-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
                  onClick={() => setLightboxAssetId(id)}
                  aria-label="ขยาย"
                >
                  <Maximize2 className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!lightboxAssetId} onOpenChange={(o) => !o && setLightboxAssetId(null)}>
        <DialogContent
          className="max-w-[min(96vw,900px)] p-2 sm:p-4"
          disableOutsideClose
        >
          <DialogHeader className="sr-only">
            <DialogTitle>ดูรูปโน้ต</DialogTitle>
          </DialogHeader>
          {lightboxAssetId && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/immich/asset/${lightboxAssetId}?type=original`}
              alt="รูปโน้ตขนาดใหญ่"
              className="w-full max-h-[80vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
