'use client'

import * as React from 'react'
import { ImagePlus, X, Maximize2, Loader2, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser'
import { IMMICH_ENABLED, IMMICH_MAINTENANCE_TEXT } from '@/lib/immich/feature'
import { useLocale } from '@/components/locale-provider'
import { isStorageAttachment } from '@/lib/attachments/ids'
import { useImmichUploadDelivery } from '@/providers/immich-upload-context'
import { useAuthenticatedImmichSrc } from '@/hooks/use-authenticated-immich-src'
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

function ImmichThumb({
  assetId,
  onOpen,
  onRemove,
}: {
  assetId: string
  onOpen: () => void
  onRemove: () => void
}) {
  const { p } = useLocale()
  const { src, loading } = useAuthenticatedImmichSrc(assetId, 'thumbnail')
  const legacyPaused = !IMMICH_ENABLED && !isStorageAttachment(assetId)

  if (legacyPaused) {
    return (
      <div
        className="flex w-20 h-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-dashed bg-muted/40 p-1 text-center"
        title={p(IMMICH_MAINTENANCE_TEXT)}
      >
        <Wrench className="size-4 text-muted-foreground" aria-hidden />
        <span className="text-xs leading-tight text-muted-foreground">
          {p({ th: 'รูปเก่า · ปรับปรุง', en: 'Old photo · maintenance', zh: '旧图片 · 维护中' })}
        </span>
      </div>
    )
  }

  return (
    <div className="relative group w-20 h-20 rounded-md border bg-muted overflow-hidden shrink-0">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="w-full h-full object-cover cursor-pointer"
          onClick={onOpen}
        />
      )}
      <button
        type="button"
        className="absolute top-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={p({ th: 'ลบรูป', en: 'Remove photo', zh: '删除图片' })}
      >
        <X className="size-3.5" />
      </button>
      <button
        type="button"
        className="absolute bottom-0.5 right-0.5 size-6 rounded-full bg-background/90 border flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        onClick={onOpen}
        aria-label={p({ th: 'ขยาย', en: 'Enlarge', zh: '放大' })}
      >
        <Maximize2 className="size-3" />
      </button>
    </div>
  )
}

export function ImmichAttachmentsField({
  value,
  onChange,
  tripId,
  deliveryKey: deliveryKeyProp,
  emptyHint: emptyHintProp,
  className,
}: ImmichAttachmentsFieldProps) {
  const { p } = useLocale()
  const emptyHint =
    emptyHintProp ??
    p({
      th: 'ไม่มีรูป — กด เพิ่มรูป หรือใช้ AI แนบโน้ต',
      en: 'No photos — tap Add photo, or attach one via AI',
      zh: '暂无图片 — 点击“添加图片”，或通过 AI 附加',
    })
  const reactId = React.useId()
  const deliveryKey = deliveryKeyProp ?? `attachments:${reactId}`
  const valueRef = React.useRef(value)
  valueRef.current = value

  const [lightboxAssetId, setLightboxAssetId] = React.useState<string | null>(null)
  const [lightboxQuality, setLightboxQuality] = React.useState<'preview' | 'original'>(
    'preview'
  )
  const {
    src: lightboxSrc,
    loading: lightboxLoading,
  } = useAuthenticatedImmichSrc(lightboxAssetId, lightboxQuality)
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

  React.useEffect(() => {
    if (!lightboxAssetId) return
    setLightboxQuality('preview')
  }, [lightboxAssetId])

  const uniqueIds = React.useMemo(() => [...new Set(value)], [value])

  const handleAddFiles = (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (list.length === 0) {
      toast.error(p({ th: 'กรุณาเลือกไฟล์รูปภาพ', en: 'Please choose an image file', zh: '请选择图片文件' }))
      return
    }

    for (const file of list) {
      const url = URL.createObjectURL(file)
      const jobId = enqueue(file, {
        tripId,
        label: file.name,
        successToast: p({ th: 'เพิ่มรูปโน้ตแล้ว', en: 'Photo added', zh: '图片已添加' }),
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
            {p({ th: 'รูปแนบ', en: 'Photos', zh: '附件图片' })}
            {uploadingCount > 0
              ? p({
                  th: ` · กำลังอัปโหลด ${uploadingCount}`,
                  en: ` · uploading ${uploadingCount}`,
                  zh: ` · 正在上传 ${uploadingCount}`,
                })
              : ''}
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
            <ImagePlus className="size-3.5" /> {p({ th: 'เพิ่มรูป', en: 'Add photo', zh: '添加图片' })}
          </Button>
        </div>
        {showEmpty ? (
          <p className="text-xs text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {localPreviews.map((preview) => (
              <div
                key={preview.jobId}
                className="relative w-20 h-20 rounded-md border bg-muted overflow-hidden shrink-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={preview.name}
                  className="w-full h-full object-cover opacity-70"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                  <Loader2 className="size-5 animate-spin text-primary" />
                </div>
              </div>
            ))}
            {uniqueIds.map((id) => (
              <ImmichThumb
                key={id}
                assetId={id}
                onOpen={() => setLightboxAssetId(id)}
                onRemove={() => {
                  void handleRemoveAttachment(id)
                }}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={!!lightboxAssetId}
        onOpenChange={(o) => {
          if (!o) {
            setLightboxAssetId(null)
            setLightboxQuality('preview')
          }
        }}
      >
        <DialogContent
          className="max-w-[min(96vw,900px)] p-2 sm:p-4"
          disableOutsideClose
        >
          <DialogHeader className="sr-only">
            <DialogTitle>{p({ th: 'ดูรูปโน้ต', en: 'View photo', zh: '查看图片' })}</DialogTitle>
          </DialogHeader>
          {lightboxAssetId && (
            <div className="relative min-h-[12rem] rounded-md bg-muted">
              {lightboxLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
              )}
              {lightboxSrc && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${lightboxAssetId}-${lightboxQuality}`}
                  src={lightboxSrc}
                  alt={p({ th: 'รูปโน้ตขนาดใหญ่', en: 'Enlarged photo', zh: '放大图片' })}
                  decoding="async"
                  className="w-full max-h-[80vh] object-contain rounded-md"
                />
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-between">
            {lightboxAssetId && isStorageAttachment(lightboxAssetId) ? (
              <span />
            ) : lightboxQuality === 'preview' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setLightboxQuality('original')
                }}
              >
                {p({ th: 'ดูต้นฉบับ', en: 'View original', zh: '查看原图' })}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground self-center">
                {p({ th: 'กำลังแสดงต้นฉบับ', en: 'Showing original', zh: '正在显示原图' })}
              </p>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setLightboxAssetId(null)}
            >
              {p({ th: 'ปิด', en: 'Close', zh: '关闭' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
