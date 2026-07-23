import { adminDb } from '@/lib/firebase-admin'
import type { AiInsightPeriodType, AiInsightReport } from '@/lib/firestore-types'
import type { DocumentData, Query } from 'firebase-admin/firestore'

function insightsCol(uid: string) {
  return adminDb().collection('users').doc(uid).collection('ai_insights')
}

function docToReport(id: string, data: DocumentData): AiInsightReport {
  return { id, ...(data as Omit<AiInsightReport, 'id'>) }
}

export async function getAiInsight(
  uid: string,
  periodKey: string
): Promise<AiInsightReport | null> {
  const snap = await insightsCol(uid).doc(periodKey).get()
  if (!snap.exists) return null
  return docToReport(snap.id, snap.data()!)
}

export async function setAiInsight(
  uid: string,
  report: AiInsightReport
): Promise<void> {
  const { id, ...rest } = report
  await insightsCol(uid).doc(id).set(rest, { merge: true })
}

export async function listAiInsightKeys(
  uid: string,
  periodType?: AiInsightPeriodType
): Promise<string[]> {
  let q: Query = insightsCol(uid)
  if (periodType) {
    q = q.where('periodType', '==', periodType)
  }
  const snap = await q.get()
  return snap.docs.map((d) => d.id).sort()
}
