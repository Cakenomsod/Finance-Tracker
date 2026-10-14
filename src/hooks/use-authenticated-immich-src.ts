'use client'

import * as React from 'react'
import { authFetch } from '@/lib/api-auth-client'
import { isStorageAttachment } from '@/lib/attachments/ids'
import { getAttachmentUrl } from '@/lib/attachments/storage'
import { IMMICH_ENABLED } from '@/lib/immich/feature'

export type ImmichImageQuality = 'thumbnail' | 'preview' | 'original'

/**
 * Resolve an attachment to an <img> src. Firebase Storage photos use a download URL
 * (single size); legacy Immich assets go through the Bearer-auth proxy.
 */
export function useAuthenticatedImmichSrc(
  assetId: string | null,
  type: ImmichImageQuality
) {
  const [src, setSrc] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(Boolean(assetId))
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!assetId) {
      setSrc(null)
      setLoading(false)
      setError(false)
      return
    }

    let blobUrl: string | null = null
    let cancelled = false

    setLoading(true)
    setError(false)
    setSrc(null)

    if (isStorageAttachment(assetId)) {
      getAttachmentUrl(assetId).then(
        (url) => {
          if (!cancelled) setSrc(url)
        },
        () => {
          if (!cancelled) setError(true)
        }
      ).finally(() => {
        if (!cancelled) setLoading(false)
      })
      return () => {
        cancelled = true
      }
    }

    if (!IMMICH_ENABLED) {
      setLoading(false)
      setError(true)
      return
    }

    void (async () => {
      try {
        const res = await authFetch(`/api/immich/asset/${assetId}?type=${type}`)
        if (!res.ok) {
          if (!cancelled) setError(true)
          return
        }
        const blob = await res.blob()
        if (cancelled) return
        blobUrl = URL.createObjectURL(blob)
        setSrc(blobUrl)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
    }
  }, [assetId, type])

  return { src, loading, error }
}
