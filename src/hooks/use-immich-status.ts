'use client'

import * as React from 'react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'
import { IMMICH_ENABLED } from '@/lib/immich/feature'
import { pickClient } from '@/lib/i18n'

function statusFailedMessage(): string {
  return pickClient({ th: 'โหลดสถานะ Immich ไม่สำเร็จ', en: 'Failed to load Immich status', zh: 'Immich 状态加载失败' })
}

export type ImmichStatus = {
  configured: boolean
  hasTunnelUrl: boolean
  hasApiKey: boolean
  host: string | null
}

const INITIAL: ImmichStatus = {
  configured: false,
  hasTunnelUrl: false,
  hasApiKey: false,
  host: null,
}

/**
 * Server Immich readiness from Photo Firebase tunnel + IMMICH_API_KEY
 * (not user profile.immich).
 */
export function useImmichStatus() {
  const { user, loading: authLoading } = useAuth()
  const [status, setStatus] = React.useState<ImmichStatus>(INITIAL)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    if (!IMMICH_ENABLED) {
      setStatus(INITIAL)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const currentUser = auth.currentUser
      if (!currentUser) {
        setStatus(INITIAL)
        return
      }
      const token = await currentUser.getIdToken()
      const res = await fetch('/api/immich/status', {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || statusFailedMessage())
      }
      setStatus({
        configured: Boolean(data.configured),
        hasTunnelUrl: Boolean(data.hasTunnelUrl),
        hasApiKey: Boolean(data.hasApiKey),
        host: typeof data.host === 'string' ? data.host : null,
      })
    } catch (err) {
      setStatus(INITIAL)
      setError(err instanceof Error ? err.message : statusFailedMessage())
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (authLoading) return
    if (!user) {
      setStatus(INITIAL)
      setLoading(false)
      return
    }
    void refresh()
  }, [authLoading, user, refresh])

  return { ...status, loading: authLoading || loading, error, refresh }
}
