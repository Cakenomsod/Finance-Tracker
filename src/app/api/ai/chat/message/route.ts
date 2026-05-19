import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { sendChatWithProvider } from '@/lib/ai';
import { adminDb } from '@/lib/firebase-admin';
import { AiTextProvider } from '@/lib/firestore-types';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, history, provider: requestedProvider } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 🚀 1. ดึงข้อมูลการตั้งค่า AI ของผู้ใช้จากฐานข้อมูลจริง
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const savedProvider = (userData?.aiTextProvider as AiTextProvider) || 'local';
    const localAiBaseUrl = userData?.localAiBaseUrl as string | undefined;

    const provider: AiTextProvider = (requestedProvider === 'gemma' || requestedProvider === 'local')
      ? requestedProvider
      : savedProvider;

    if (provider === 'local' && !localAiBaseUrl) {
      return NextResponse.json(
        { error: 'กรุณาตั้งค่า Local AI Base URL ในหน้า Settings ก่อนใช้งานแชท' },
        { status: 400 }
      );
    }

    const response = await sendChatWithProvider(message, {
      provider,
      localAiConfig: (provider === 'local' && localAiBaseUrl) ? { baseUrl: localAiBaseUrl } : undefined,
    }, history);

    return NextResponse.json({ response });
  } catch (error) {
    console.error('Chat error:', error);
    const message = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}