import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserAiSettings } from '@/lib/api-auth';
import { testLocalAiConnection } from '@/lib/ai';
import { photoDb } from '@/lib/photo-firebase-admin';

export async function POST(request: NextRequest) {
  // Note: ไม่ต้องเช็ค session สำหรับการ test Local AI ในระหว่างการพัฒนา
  // เพราะ test ของ Settings ไม่ได้ต้องการ user settings จาก Firestore

  try {
    const configDoc = await photoDb().collection('system').doc('tunnel_config').get();
    if (!configDoc.exists) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลท่อเชื่อมต่อบนคลาวด์ยานแม่' },
        { status: 503 }
      );
    }

    const sharedLocalAiUrl = String(configDoc.data()?.ai_url || '').trim().replace(/\/$/, '');
    if (!sharedLocalAiUrl) {
      return NextResponse.json(
        { error: 'ยังไม่มีลิงก์ Local AI ปัจจุบันในระบบคลาวด์' },
        { status: 400 }
      );
    }

    const connected = await testLocalAiConnection({ baseUrl: sharedLocalAiUrl });

    if (connected) {
      return NextResponse.json({ 
        success: true, 
        message: 'เชื่อมต่อกับ Local AI คอมบ้านสำเร็จ!',
        testedUrl: sharedLocalAiUrl
      });
    }

    return NextResponse.json(
      { success: false, message: `ไม่สามารถเชื่อมต่อไปยัง Local AI ได้ (ลิงก์ปัจจุบัน: ${sharedLocalAiUrl})` },
      { status: 500 }
    );
  } catch (error) {
    console.error('Local AI test error:', error);
    const errMessage = error instanceof Error ? error.message : 'Test failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}