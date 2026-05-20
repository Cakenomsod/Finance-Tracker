import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { testLocalAiConnection } from '@/lib/ai';
import { photoDb } from '@/lib/photo-firebase-admin'; // 👈 1. อิมพอร์ตสายสืบข้ามค่ายเข้ามา

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 📡 2. ลอจิกใหม่: วิ่งไปสอยลิงก์ล่าสุดจาก Firestore ของโปรเจกต์ Photo มาทดสอบทันที
    const configDoc = await photoDb.collection('system').doc('tunnel_config').get();
    
    if (!configDoc.exists) {
      return NextResponse.json(
        { success: false, message: 'ไม่พบข้อมูลท่อเชื่อมต่อบนคลาวด์ยานแม่' },
        { status: 503 }
      );
    }

    // คว้าค่า ai_url จากคอมบ้านมาเช็ก
    const currentAiUrl = configDoc.data()?.ai_url || "";

    if (!currentAiUrl) {
      return NextResponse.json(
        { success: false, message: 'บนคลาวด์ยังไม่มีการอัปเดตลิงก์ Local AI ปัจจุบัน' },
        { status: 400 }
      );
    }

    // 🤖 3. ส่งลิงก์ไดนามิกที่ดึงได้สดๆ ไปเช็กดูว่าคอมที่บ้านกำลังเปิดโปรแกรม AI (เช่น LM Studio) ทิ้งไว้ไหม
    const connected = await testLocalAiConnection({ baseUrl: currentAiUrl });

    if (connected) {
      return NextResponse.json({ 
        success: true, 
        message: 'เชื่อมต่อกับ Local AI คอมบ้านสำเร็จ!',
        testedUrl: currentAiUrl // แถมลิงก์บอกหน้าบ้านหน่อยว่าทดสอบผ่านท่อไหนอยู่
      });
    }

    return NextResponse.json(
      { success: false, message: `ไม่สามารถเชื่อมต่อไปยัง Local AI ได้ (ลิงก์ปัจจุบัน: ${currentAiUrl})` },
      { status: 500 }
    );
  } catch (error) {
    console.error('Local AI test error:', error);
    const errMessage = error instanceof Error ? error.message : 'Test failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}