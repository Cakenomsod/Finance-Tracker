import { AiTextProvider } from '@/lib/firestore-types'
import { ReceiptParseResult } from '@/lib/ai/receipt-schema'

export type AiParseJobStatus = 'processing' | 'done' | 'error'

export interface AiParseJob {
  id: string
  createdAt: number
  status: AiParseJobStatus
  provider: AiTextProvider
  kind: 'text' | 'receipt'
  inputLabel: string
  error?: string
  result?: ReceiptParseResult
  immichIds: string[]
}

const MAX_JOBS = 30
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function storageKey(scope: string) {
  return `finance-ai-parse-jobs:${scope}`
}

export function loadAiParseJobs(scope: string): AiParseJob[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(storageKey(scope))
    if (!raw) return []
    const parsed = JSON.parse(raw) as AiParseJob[]
    if (!Array.isArray(parsed)) return []

    const cutoff = Date.now() - MAX_AGE_MS
    return parsed
      .filter((j) => j && typeof j.id === 'string' && j.createdAt >= cutoff)
      .map((j) =>
        j.status === 'processing'
          ? {
              ...j,
              status: 'error' as const,
              error: 'การประมวลผลขัดจังหวะ — ลองส่งใหม่',
            }
          : j
      )
      .slice(0, MAX_JOBS)
  } catch {
    return []
  }
}

export function saveAiParseJobs(scope: string, jobs: AiParseJob[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(scope), JSON.stringify(jobs.slice(0, MAX_JOBS)))
  } catch {
    // quota exceeded — drop oldest
  }
}

export function createAiParseJob(
  partial: Pick<AiParseJob, 'provider' | 'kind' | 'inputLabel' | 'immichIds'>
): AiParseJob {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    createdAt: Date.now(),
    status: 'processing',
    ...partial,
  }
}
