import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { testImmichConnection } from '@/lib/immich/client';
import { photoDb } from '@/lib/photo-firebase-admin';


export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const apiKey = process.env.IMMICH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'IMMICH_API_KEY ยังไม่ได้ตั้งค่าในเซิร์ฟเวอร์' },
        { status: 503 }
      );
    }

    // 📡 2. ลอจิกใหม่: วิ่งไปสอยลิงก์มุดท่อ Immich ตัวล่าสุดจาก Firestore โปรเจกต์ Photo
    const configDoc = await photoDb().collection('system').doc('tunnel_config').get();
    
    if (!configDoc.exists) {
      return NextResponse.json(
        { error: 'ไม่พบข้อมูลท่อเชื่อมต่อบนคลาวด์ยานแม่ (คอมบ้านอาจจะยังไม่ได้ส่งข้อมูล)' }, 
        { status: 503 }
      );
    }

    // ดึงค่า immich_url ปัจจุบัน
    const currentImmichUrl = configDoc.data()?.immich_url || "";

    if (!currentImmichUrl) {
      return NextResponse.json(
        { error: 'คอมบ้านเชื่อมต่อท่อสำเร็จ แต่ยังไม่ได้เปิดใช้งานหรือส่งลิงก์ Immich ขึ้นมา' }, 
        { status: 400 }
      );
    }

    // 🎯 3. ส่งลิงก์ไดนามิกที่ดึงได้สดๆ คู่กับ apiKey ไปทดสอบเชื่อมต่อกับคอมที่บ้าน
    const ok = await testImmichConnection({ baseUrl: currentImmichUrl, apiKey });
    if (!ok) {
      return NextResponse.json(
        { error: `ไม่สามารถเชื่อมต่อไปยัง Immich ได้ (ลิงก์ปัจจุบัน: ${currentImmichUrl})` }, 
        { status: 400 }
      );
    }

    return NextResponse.json({ 
      ok: true,
      message: 'เชื่อมต่อคลังภาพ Immich สำเร็จ!',
      testedUrl: currentImmichUrl // ส่งลิงก์กลับไปบอกหน้าบ้านเผื่อใช้แสดงสถานะ
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}