import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { testImmichConnection } from '@/lib/immich/client';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { baseUrl, apiKey } = await request.json();
    if (!baseUrl || !apiKey) {
      return NextResponse.json({ error: 'baseUrl and apiKey are required' }, { status: 400 });
    }

    const ok = await testImmichConnection({ baseUrl, apiKey });
    if (!ok) {
      return NextResponse.json({ error: 'Connection failed' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
