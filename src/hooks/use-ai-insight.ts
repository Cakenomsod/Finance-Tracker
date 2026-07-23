'use client'

import * as React from 'react'

import {
  fetchAiInsight,
  generateAiInsight,
} from '@/lib/ai-insights'
import type {
  AiInsightPeriodType,
  AiInsightReport,
} from '@/lib/firestore-types'
import { useAuth } from '@/hooks/use-auth'

export interface UseAiInsightResult {
  report: AiInsightReport | null
  loading: boolean
  generating: boolean
  error: string | null
  refresh: (options?: { force?: boolean }) => Promise<void>
  generate: (options?: { force?: boolean }) => Promise<void>
}

export function useAiInsight(
  periodType: AiInsightPeriodType,
  periodKey: string
): UseAiInsightResult {
  const { user } = useAuth()
  const [report, setReport] = React.useState<AiInsightReport | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [generating, setGenerating] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    if (!user || !periodKey) {
      setReport(null)
      setLoading(false)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const next = await fetchAiInsight(periodType, periodKey)
      setReport(next)
    } catch (err) {
      setReport(null)
      setError(err instanceof Error ? err.message : 'โหลดรายงานไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [user, periodType, periodKey])

  React.useEffect(() => {
    void load()
  }, [load])

  const generate = React.useCallback(
    async (options?: { force?: boolean }) => {
      if (!user || !periodKey) return

      setGenerating(true)
      setError(null)
      try {
        const next = await generateAiInsight({
          periodType,
          periodKey,
          force: options?.force ?? true,
        })
        setReport(next)
        if (next.status === 'failed') {
          setError(next.errorMessage || 'สร้างรายงานไม่สำเร็จ')
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'สร้างรายงานไม่สำเร็จ')
      } finally {
        setGenerating(false)
      }
    },
    [user, periodType, periodKey]
  )

  const refresh = React.useCallback(
    async (options?: { force?: boolean }) => {
      if (options?.force) {
        await generate({ force: true })
        return
      }
      await load()
    },
    [generate, load]
  )

  return {
    report,
    loading,
    generating,
    error,
    refresh,
    generate,
  }
}
