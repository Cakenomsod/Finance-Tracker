'use client'

import * as React from 'react'
import { Loader2, CheckCircle2, AlertCircle, X, Upload } from 'lucide-react'
import { uploadAttachmentImage } from '@/lib/immich/upload-client'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useLocale } from '@/components/locale-provider'
import { pickClient } from '@/lib/i18n'

function uploadFailedMessage() {
  return pickClient({ th: 'อัปโหลดไม่สำเร็จ', en: 'Upload failed', zh: '上传失败' })
}

export type ImmichUploadJobStatus = 'uploading' | 'done' | 'error'

export interface ImmichUploadJob {
  id: string
  fileName: string
  status: ImmichUploadJobStatus
  deliveryKey: string
  tripId?: string | null
  assetId?: string
  error?: string
  createdAt: number
}

interface EnqueueOptions {
  file: File
  deliveryKey: string
  tripId?: string | null
  /** Shown in toast / status list */
  label?: string
  successToast?: string
}

interface ImmichUploadContextValue {
  jobs: ImmichUploadJob[]
  activeCount: number
  enqueue: (options: EnqueueOptions) => string
  dismissJob: (id: string) => void
  /** Register a listener; flushes any assets completed while unmounted. Returns unsubscribe. */
  subscribeDelivery: (
    deliveryKey: string,
    onAsset: (assetId: string) => void
  ) => () => void
}

const ImmichUploadContext = React.createContext<ImmichUploadContextValue | null>(null)

const MAX_VISIBLE_DONE = 8
const DONE_AUTO_DISMISS_MS = 12_000

function createJobId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function ImmichUploadProvider({ children }: { children: React.ReactNode }) {
  const { p } = useLocale()
  const [jobs, setJobs] = React.useState<ImmichUploadJob[]>([])
  const listenersRef = React.useRef(new Map<string, Set<(assetId: string) => void>>())
  const pendingRef = React.useRef(new Map<string, string[]>())
  const toastIdsRef = React.useRef(new Map<string, string | number>())

  const dismissJob = React.useCallback((id: string) => {
    setJobs((prev) => prev.filter((j) => j.id !== id))
    const toastId = toastIdsRef.current.get(id)
    if (toastId !== undefined) {
      toast.dismiss(toastId)
      toastIdsRef.current.delete(id)
    }
  }, [])

  const deliver = React.useCallback((deliveryKey: string, assetId: string) => {
    const listeners = listenersRef.current.get(deliveryKey)
    if (listeners && listeners.size > 0) {
      listeners.forEach((fn) => {
        try {
          fn(assetId)
        } catch (e) {
          console.error('[ImmichUpload] delivery listener failed', e)
        }
      })
      return
    }
    const q = pendingRef.current.get(deliveryKey) ?? []
    pendingRef.current.set(deliveryKey, [...q, assetId])
  }, [])

  const subscribeDelivery = React.useCallback(
    (deliveryKey: string, onAsset: (assetId: string) => void) => {
      let set = listenersRef.current.get(deliveryKey)
      if (!set) {
        set = new Set()
        listenersRef.current.set(deliveryKey, set)
      }
      set.add(onAsset)

      const pending = pendingRef.current.get(deliveryKey)
      if (pending?.length) {
        pendingRef.current.delete(deliveryKey)
        for (const id of pending) {
          try {
            onAsset(id)
          } catch (e) {
            console.error('[ImmichUpload] flush pending failed', e)
          }
        }
      }

      return () => {
        const current = listenersRef.current.get(deliveryKey)
        current?.delete(onAsset)
        if (current && current.size === 0) {
          listenersRef.current.delete(deliveryKey)
        }
      }
    },
    []
  )

  const enqueue = React.useCallback(
    ({ file, deliveryKey, tripId, label, successToast }: EnqueueOptions) => {
      const id = createJobId()
      const fileName = label || file.name || pickClient({ th: 'รูปภาพ', en: 'Photo', zh: '图片' })
      const job: ImmichUploadJob = {
        id,
        fileName,
        status: 'uploading',
        deliveryKey,
        tripId,
        createdAt: Date.now(),
      }

      setJobs((prev) => [job, ...prev].slice(0, 40))

      const toastId = toast.loading(
        pickClient({
          th: `กำลังอัปโหลด: ${fileName}`,
          en: `Uploading: ${fileName}`,
          zh: `正在上传：${fileName}`,
        }),
        {
          description: pickClient({
            th: 'ทำอย่างอื่นต่อได้ — อัปโหลดทำงานเบื้องหลัง',
            en: 'Feel free to keep going — it uploads in the background',
            zh: '可以继续操作 — 上传在后台进行',
          }),
        }
      )
      toastIdsRef.current.set(id, toastId)

      void (async () => {
        try {
          const { assetId } = await uploadAttachmentImage(file, { tripId })
          deliver(deliveryKey, assetId)
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: 'done' as const, assetId } : j
            )
          )
          toast.success(
            successToast ||
              pickClient({ th: 'อัปโหลดรูปสำเร็จ', en: 'Photo uploaded', zh: '图片上传成功' }),
            { id: toastId }
          )
          window.setTimeout(() => dismissJob(id), DONE_AUTO_DISMISS_MS)
        } catch (err) {
          const message = err instanceof Error ? err.message : uploadFailedMessage()
          setJobs((prev) =>
            prev.map((j) =>
              j.id === id ? { ...j, status: 'error' as const, error: message } : j
            )
          )
          toast.error(message, { id: toastId })
        }
      })()

      return id
    },
    [deliver, dismissJob]
  )

  const activeCount = jobs.filter((j) => j.status === 'uploading').length

  const value = React.useMemo(
    () => ({
      jobs,
      activeCount,
      enqueue,
      dismissJob,
      subscribeDelivery,
    }),
    [jobs, activeCount, enqueue, dismissJob, subscribeDelivery]
  )

  const visibleJobs = React.useMemo(() => {
    const uploading = jobs.filter((j) => j.status === 'uploading')
    const rest = jobs
      .filter((j) => j.status !== 'uploading')
      .slice(0, MAX_VISIBLE_DONE)
    return [...uploading, ...rest]
  }, [jobs])

  return (
    <ImmichUploadContext.Provider value={value}>
      {children}
      {visibleJobs.length > 0 && (
        <div
          data-immich-upload-panel
          className="pointer-events-none fixed top-4 right-4 z-[60] flex w-[min(100vw-2rem,20rem)] flex-col gap-2 max-sm:top-3 max-sm:right-3"
          aria-live="polite"
        >
          <div className="pointer-events-auto rounded-lg border bg-card shadow-md">
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Upload className="size-3.5 text-muted-foreground" aria-hidden />
              <p className="min-w-0 flex-1 text-xs font-medium">
                {p({ th: 'อัปโหลดรูป', en: 'Photo uploads', zh: '图片上传' })}
                {activeCount > 0
                  ? p({
                      th: ` (${activeCount} กำลังทำ)`,
                      en: ` (${activeCount} in progress)`,
                      zh: `（${activeCount} 个进行中）`,
                    })
                  : ''}
              </p>
              {activeCount === 0 && (
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    for (const job of visibleJobs) dismissJob(job.id)
                  }}
                  aria-label={p({
                    th: 'ปิดแผงสถานะอัปโหลด',
                    en: 'Close upload panel',
                    zh: '关闭上传面板',
                  })}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <ul className="max-h-48 space-y-1 overflow-y-auto p-2">
              {visibleJobs.map((job) => (
                <li
                  key={job.id}
                  className={cn(
                    'flex items-start gap-2 rounded-md px-2 py-1.5 text-xs',
                    job.status === 'error' && 'bg-destructive/5',
                    job.status === 'done' && 'bg-primary/5'
                  )}
                >
                  {job.status === 'uploading' && (
                    <Loader2 className="mt-0.5 size-3.5 shrink-0 animate-spin text-primary" />
                  )}
                  {job.status === 'done' && (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                  )}
                  {job.status === 'error' && (
                    <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{job.fileName}</p>
                    <p className="text-muted-foreground">
                      {job.status === 'uploading' &&
                        p({ th: 'กำลังอัปโหลด...', en: 'Uploading...', zh: '正在上传...' })}
                      {job.status === 'done' && p({ th: 'เสร็จแล้ว', en: 'Done', zh: '已完成' })}
                      {job.status === 'error' &&
                        (job.error || p({ th: 'ล้มเหลว', en: 'Failed', zh: '失败' }))}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      dismissJob(job.id)
                    }}
                    aria-label={p({ th: 'ปิดสถานะอัปโหลด', en: 'Dismiss', zh: '关闭' })}
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </ImmichUploadContext.Provider>
  )
}

export function useImmichUpload() {
  const ctx = React.useContext(ImmichUploadContext)
  if (!ctx) {
    throw new Error('useImmichUpload must be used within ImmichUploadProvider')
  }
  return ctx
}

/** Safe optional hook for components that may render outside the provider (e.g. tests). */
export function useImmichUploadOptional() {
  return React.useContext(ImmichUploadContext)
}

/**
 * Enqueue uploads and receive asset IDs for a delivery key.
 * Completions still arrive if the consumer remounts later.
 */
export function useImmichUploadDelivery(
  deliveryKey: string,
  onAsset: (assetId: string) => void
) {
  const upload = useImmichUploadOptional()
  const onAssetRef = React.useRef(onAsset)
  onAssetRef.current = onAsset

  React.useEffect(() => {
    if (!upload) return
    return upload.subscribeDelivery(deliveryKey, (id) => onAssetRef.current(id))
  }, [upload, deliveryKey])

  const enqueue = React.useCallback(
    (
      file: File,
      options?: {
        tripId?: string | null
        label?: string
        successToast?: string
      }
    ) => {
      if (!upload) {
        // Fallback: direct upload without background panel
        void uploadAttachmentImage(file, { tripId: options?.tripId }).then(
          ({ assetId }) => onAssetRef.current(assetId),
          (err) =>
            toast.error(err instanceof Error ? err.message : uploadFailedMessage())
        )
        return ''
      }
      return upload.enqueue({
        file,
        deliveryKey,
        tripId: options?.tripId,
        label: options?.label,
        successToast: options?.successToast,
      })
    },
    [upload, deliveryKey]
  )

  const jobsForKey = React.useMemo(
    () => (upload ? upload.jobs.filter((j) => j.deliveryKey === deliveryKey) : []),
    [upload, deliveryKey]
  )

  const uploadingCount = jobsForKey.filter((j) => j.status === 'uploading').length

  return { enqueue, jobs: jobsForKey, uploadingCount }
}
