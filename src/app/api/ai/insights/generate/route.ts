import { NextRequest, NextResponse } from 'next/server'
import { verifySession } from '@/lib/api-auth'
import { generateInsightReportForUser } from '@/lib/ai/generate-insight-report'
import type { AiInsightPeriodType } from '@/lib/firestore-types'
import { parseMonthKey, parseWeekKey } from '@/lib/insight-periods'

export async function POST(request: NextRequest) {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const periodType = body?.periodType as AiInsightPeriodType | undefined
    const periodKey = body?.periodKey as string | undefined
    const force = Boolean(body?.force)

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

    const { report } = await generateInsightReportForUser(
      session.uid,
      periodType,
      periodKey,
      { force }
    )

    return NextResponse.json({ report })
  } catch (error) {
    console.error('[API] POST /api/ai/insights/generate failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    const errMessage = error instanceof Error ? error.message : 'Insight generation failed'
    return NextResponse.json({ error: errMessage }, { status: 500 })
  }
}
