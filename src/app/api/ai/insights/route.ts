import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/api-auth'
import type { AiInsightPeriodType } from '@/lib/firestore-types'
import { getAiInsight } from '@/lib/ai/insights-store'
import { parseMonthKey, parseWeekKey } from '@/lib/insight-periods'

export async function GET(request: NextRequest) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = request.nextUrl
    const periodType = searchParams.get('periodType') as AiInsightPeriodType | null
    const periodKey = searchParams.get('periodKey')

    if (periodType !== 'week' && periodType !== 'month') {
      return NextResponse.json(
        { error: 'periodType must be "week" or "month"' },
        { status: 400 }
      )
    }

    if (!periodKey || typeof periodKey !== 'string') {
      return NextResponse.json({ error: 'periodKey is required' }, { status: 400 })
    }

    if (periodType === 'month' && !parseMonthKey(periodKey)) {
      return NextResponse.json(
        { error: 'Invalid periodKey — expected YYYY-MM' },
        { status: 400 }
      )
    }
    if (periodType === 'week' && !parseWeekKey(periodKey)) {
      return NextResponse.json(
        { error: 'Invalid periodKey — expected YYYY-Www' },
        { status: 400 }
      )
    }

    const report = await getAiInsight(session.uid, periodKey)
    return NextResponse.json({ report })
  } catch (error) {
    console.error('[API] GET /api/ai/insights failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    const errMessage = error instanceof Error ? error.message : 'Failed to load insight'
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
