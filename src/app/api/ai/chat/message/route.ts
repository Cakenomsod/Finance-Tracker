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
    const { message, history } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // 🚀 1. ดึงข้อมูลการตั้งค่า AI ของผู้ใช้จากฐานข้อมูลจริง
    const userDoc = await adminDb.collection('users').doc(session.uid).get();
    
    // 💡 แผนสำรองกรณีหา Document ไม่เจอ หรือติดเรื่องสิทธิ์ Credentials ในบางจังหวะ
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const userData = userDoc.data();
    const provider = (userData?.aiTextProvider as AiTextProvider) || 'local'; // ฟอลแบ็กไป local เป็นหลัก
    const localAiBaseUrl = userData?.localAiBaseUrl as string | undefined;

    // 🚀 2. ดักด่านตรวจสอบเพื่อความชัวร์ก่อนส่งต่อให้ฟังก์ชันหลัก
    if (provider === 'local' && !localAiBaseUrl) {
      return NextResponse.json(
        { error: 'กรุณาตั้งค่า Local AI Base URL ในหน้า Settings ก่อนใช้งานแชท' },
        { status: 400 }
      );
    }

    // 🚀 3. ส่งข้อมูลคุยกับ AI โดยใช้เครื่องหมาย ! การันตีไทป์ string ให้ TypeScript สบายใจ
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