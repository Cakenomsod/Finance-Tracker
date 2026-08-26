/**
 * Daily cron to refresh FX rates.
 *
 * Auth: `Authorization: Bearer <CRON_SECRET>` or header `x-cron-secret: <CRON_SECRET>`
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFxRates } from '@/lib/fx/store';
import { envTrim } from '@/lib/ai/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function getCronSecretFromRequest(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice('Bearer '.length).trim();
    if (token) return token;
  }
  return request.headers.get('x-cron-secret')?.trim() || null;
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

async function runCron(request: NextRequest) {
  const authError = assertCronAuthorized(request);
  if (authError) return authError;

  try {
    const result = await getFxRates({ forceRefresh: true });
    return NextResponse.json({
      ok: true,
      source: result.source,
      fetchedAt: result.fetchedAt.toISOString(),
      rateCount: Object.keys(result.rates).length,
    });
  } catch (err) {
    console.error('[FX] cron error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return runCron(request);
}

export async function GET(request: NextRequest) {
  return runCron(request);
}
