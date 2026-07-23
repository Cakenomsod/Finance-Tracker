/**
 * Batch cron for AI Insights (weekly / monthly).
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`
 * Set `CRON_SECRET` in the server environment (see `.env.example`).
 *
 * Body or query: `{ periodType: 'week' | 'month', periodKey?: string }`
 * - `periodType` is required
 * - `periodKey` defaults to the previous complete ISO week (`YYYY-Www`) or calendar month (`YYYY-MM`)
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { envTrim } from '@/lib/ai/env';
import {
  generateInsightReportForUser,
  mapWithConcurrency,
  resolveCronPeriodKey,
} from '@/lib/ai/generate-insight-report';
import type { AiInsightPeriodType } from '@/lib/firestore-types';

export const runtime = 'nodejs';
export const maxDuration = 300;

const CONCURRENCY = 3;

function getCronSecretFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token) return token;
  }
  const header = request.headers.get('x-cron-secret');
  return header?.trim() || null;
}

function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const expected = envTrim('CRON_SECRET');
  if (!expected) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on the server' },
      { status: 503 }
    );
  }
  const provided = getCronSecretFromRequest(request);
  if (!provided || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

async function parsePeriodInput(
  request: NextRequest
): Promise<{ periodType: AiInsightPeriodType; periodKey?: string } | { error: string }> {
  const url = new URL(request.url);
  let periodType = url.searchParams.get('periodType') as AiInsightPeriodType | null;
  let periodKey = url.searchParams.get('periodKey') || undefined;

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null);
    if (body && typeof body === 'object') {
      if (typeof (body as { periodType?: unknown }).periodType === 'string') {
        periodType = (body as { periodType: string }).periodType as AiInsightPeriodType;
      }
      const key = (body as { periodKey?: unknown }).periodKey;
      if (typeof key === 'string' && key.trim()) {
        periodKey = key.trim();
      }
    }
  }

  if (periodType !== 'week' && periodType !== 'month') {
    return {
      error: "periodType is required and must be 'week' or 'month'",
    };
  }

  return { periodType, periodKey };
}

async function listOptedInUserIds(periodType: AiInsightPeriodType): Promise<string[]> {
  // undefined flags are treated as false — only users who explicitly opted in
  const field = periodType === 'week' ? 'aiInsightsWeekly' : 'aiInsightsMonthly';
  const snap = await adminDb().collection('users').where(field, '==', true).get();
  return snap.docs.map((d) => d.id);
}

async function runCron(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  const parsed = await parsePeriodInput(request);
  if ('error' in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  let periodKey: string;
  try {
    periodKey = resolveCronPeriodKey(parsed.periodType, parsed.periodKey);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Invalid periodKey' },
      { status: 400 }
    );
  }

  const userIds = await listOptedInUserIds(parsed.periodType);

  const outcomes = await mapWithConcurrency(userIds, CONCURRENCY, async (uid) => {
    try {
      const { report } = await generateInsightReportForUser(
        uid,
        parsed.periodType,
        periodKey,
        {
          force: false,
          skipGeneratingStatus: true,
        }
      );
      if (report.status === 'failed') {
        return {
          ok: false as const,
          uid,
          error: report.errorMessage || 'Insight generation failed',
        };
      }
      return { ok: true as const, uid };
    } catch (err) {
      return {
        ok: false as const,
        uid,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  const errors = outcomes
    .filter((o): o is { ok: false; uid: string; error: string } => !o.ok)
    .map(({ uid, error }) => ({ uid, error }));
  const succeeded = outcomes.filter((o) => o.ok).length;
  const failed = errors.length;

  return NextResponse.json({
    periodType: parsed.periodType,
    periodKey,
    processed: userIds.length,
    succeeded,
    failed,
    ...(errors.length > 0 ? { errors: errors.slice(0, 50) } : {}),
  });
}

export async function POST(request: NextRequest) {
  return runCron(request);
}

/** Allow GET with query params for simple probes / schedulers. */
export async function GET(request: NextRequest) {
  return runCron(request);
}
