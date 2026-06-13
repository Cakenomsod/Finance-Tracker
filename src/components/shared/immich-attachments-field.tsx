'use client'

import * as React from 'react'
import { ImagePlus, X, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { requestDeleteImmichAssets } from '@/lib/immich/delete-from-browser'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface ImmichAttachmentsFieldProps {
  value: string[]
  onChange: (ids: string[]) => void
  tripId?: string | null
  emptyHint?: string
  className?: string
}

export function ImmichAttachmentsField({
  value,
  onChange,
  tripId,
  emptyHint = 'ไม่มีรูป — กด เพิ่มรูป หรือใช้ AI แนบโน้ต',
  className,
}: ImmichAttachmentsFieldProps) {
  const [lightboxAssetId, setLightboxAssetId] = React.useState<string | null>(null)
  const [uploadingAttach, setUploadingAttach] = React.useState(false)
  const attachInputRef = React.useRef<HTMLInputElement>(null)

  const uniqueIds = React.useMemo(() => [...new Set(value)], [value])

  const handleAddAttachment = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    setUploadingAttach(true)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('filename', file.name)
      if (tripId && tripId !== 'none') form.append('tripId', tripId)
      const res = await fetch('/api/immich/upload', { method: 'POST', body: form, credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      onChange([...new Set([...value, data.assetId as string])])
      toast.success('เพิ่มรูปโน้ตแล้ว')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ')
    } finally {
      setUploadingAttach(false)
    }
  }

  const handleRemoveAttachment = async (id: string) => {
    await requestDeleteImmichAssets([id])
    onChange(value.filter((x) => x !== id))
  }

  return (
    <>
      <div className={cn('rounded-lg border bg-muted/40 p-3 space-y-3', className)}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">รูปโน้ต (Immich)</p>
          <input
            ref={attachInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) handleAddAttachment(f)
              e.target.value = ''
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={uploadingAttach}
            onClick={() => attachInputRef.current?.click()}
          >
            {uploadingAttach ? '...' : <><ImagePlus className="size-3.5" /> เพิ่มรูป</>}
          </Button>
        </div>
        {uniqueIds.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">{emptyHint}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
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
        <DialogContent className="max-w-[min(96vw,900px)] p-2 sm:p-4">
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
