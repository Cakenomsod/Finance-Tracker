import { NextRequest, NextResponse } from 'next/server';
import { validateSignature } from '@line/bot-sdk';
import { handleLineEvent } from '@/lib/line/handler';
import { getLineConfig } from '@/lib/line/config';

export async function POST(request: NextRequest) {
  try {
    const config = getLineConfig();
    const signature = request.headers.get('x-line-signature') || '';
    const bodyText = await request.text();
    
    if (config.channelSecret && !validateSignature(bodyText, config.channelSecret, signature)) {
      console.warn('Invalid LINE signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    
    const body = JSON.parse(bodyText);
    
    if (body.events && body.events.length > 0) {
      // Process events concurrently
      await Promise.all(body.events.map(handleLineEvent));
    }
    
    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('LINE Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
