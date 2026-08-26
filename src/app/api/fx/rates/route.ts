import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { getFxRates } from '@/lib/fx/store';
import { envTrim } from '@/lib/ai/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isCronAuthorized(request: NextRequest): boolean {
  const expected = envTrim('CRON_SECRET');
  if (!expected) return false;
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length).trim() === expected;
  }
  return (request.headers.get('x-cron-secret')?.trim() ?? '') === expected;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const forceRefresh = url.searchParams.get('refresh') === '1';

  if (forceRefresh) {
    const [session, cronOk] = await Promise.all([
      verifySession(),
      Promise.resolve(isCronAuthorized(request)),
    ]);
    if (!session && !cronOk) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const result = await getFxRates({ forceRefresh });
    return NextResponse.json({
      base: result.base,
      rates: result.rates,
      fetchedAt: result.fetchedAt.toISOString(),
      source: result.source,
    });
  } catch (err) {
    console.error('[FX] /api/fx/rates error:', err);
    return NextResponse.json({ error: 'Failed to fetch FX rates' }, { status: 500 });
  }
}
