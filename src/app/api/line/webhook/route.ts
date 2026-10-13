import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, type webhook } from '@line/bot-sdk';
import { handleLineEvent } from '@/lib/line/handler';
import { getLineConfig } from '@/lib/line/config';

export async function POST(request: NextRequest) {
  const config = getLineConfig();
  const signature = request.headers.get('x-line-signature') || '';
  const bodyText = await request.text();

  if (!config.channelSecret) {
    console.error('[LINE webhook] LINE_CHANNEL_SECRET is not set');
    return NextResponse.json({ error: 'LINE is not configured' }, { status: 503 });
  }
  if (!validateSignature(bodyText, config.channelSecret, signature)) {
    console.warn('[LINE webhook] invalid signature — check LINE_CHANNEL_SECRET matches the channel');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let events: webhook.Event[] = [];
  try {
    events = (JSON.parse(bodyText) as webhook.CallbackRequest).events ?? [];
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  // Each event replies on its own; one failure must not fail the batch, and a
  // non-200 makes LINE retry / mark the webhook as erroring.
  const results = await Promise.allSettled(events.map(handleLineEvent));
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.error('[LINE webhook] event failed', { type: events[i]?.type, error: r.reason });
    }
  });

  return NextResponse.json({ status: 'ok' });
}
