'use client'

import * as React from 'react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/hooks/use-auth'

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
        throw new Error(data.error || 'Failed to load Immich status')
      }
      setStatus({
        configured: Boolean(data.configured),
        hasTunnelUrl: Boolean(data.hasTunnelUrl),
        hasApiKey: Boolean(data.hasApiKey),
        host: typeof data.host === 'string' ? data.host : null,
      })
    } catch (err) {
      setStatus(INITIAL)
      setError(err instanceof Error ? err.message : 'Failed to load Immich status')
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
