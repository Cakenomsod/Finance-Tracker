import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings } from '@/lib/api-auth';
import { deleteImmichAssets } from '@/lib/immich/client';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const ids = (body as { ids?: unknown }).ids;
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
    return NextResponse.json({ error: 'ids: string[] required' }, { status: 400 });
  }

  const immich = await getUserImmichSettings(session.uid);
  if (!immich) {
    return NextResponse.json({ error: 'Immich not configured' }, { status: 400 });
  }

  try {
    await deleteImmichAssets(immich, ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Immich] POST /api/immich/delete failed:', error);
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
