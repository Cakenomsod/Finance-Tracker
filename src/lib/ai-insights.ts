import { readApiJson } from '@/lib/api-json'
import type {
  AiInsightPeriodType,
  AiInsightReport,
} from '@/lib/firestore-types'

export type {
  AiInsightPeriodType,
  AiInsightHighlight,
  AiInsightTip,
  AiInsightAnomaly,
  AiInsightStats,
  AiInsightReport,
} from '@/lib/firestore-types'

export {
  type WeekSelection,
  formatMonthKey,
  parseMonthKey,
  formatWeekKey,
  parseWeekKey,
  getCurrentWeekSelection,
  getPreviousWeekSelection,
  getNextWeekSelection,
  getWeekDateRange,
  isCurrentWeekSelection,
  listWeekKeysWithData,
  listMonthKeysWithData,
  formatWeekLabel,
  weekRangeIso,
} from '@/lib/insight-periods'

export type GenerateAiInsightBody = {
  periodType: AiInsightPeriodType
  periodKey: string
  force?: boolean
}

export type AiInsightResponse = {
  report: AiInsightReport | null
  error?: string
}

export type GenerateAiInsightResponse = {
  report: AiInsightReport
  error?: string
}

/** GET /api/ai/insights?periodType=&periodKey= */
export async function fetchAiInsight(
  periodType: AiInsightPeriodType,
  periodKey: string
): Promise<AiInsightReport | null> {
  const params = new URLSearchParams({ periodType, periodKey })
  const res = await fetch(`/api/ai/insights?${params.toString()}`, {
    method: 'GET',
    credentials: 'same-origin',
  })

  const data = await readApiJson<AiInsightResponse>(res)
  if (!res.ok) {
    throw new Error(data.error || `Failed to load AI insight (${res.status})`)
  }
  return data.report ?? null
}

/** POST /api/ai/insights/generate */
export async function generateAiInsight(
  body: GenerateAiInsightBody
): Promise<AiInsightReport> {
  const res = await fetch('/api/ai/insights/generate', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const data = await readApiJson<GenerateAiInsightResponse>(res)
  if (!res.ok) {
    throw new Error(data.error || `Failed to generate AI insight (${res.status})`)
  }
  if (!data.report) {
    throw new Error('Failed to generate AI insight (empty response)')
  }
  return data.report
}
