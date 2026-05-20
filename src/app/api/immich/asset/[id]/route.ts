import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings } from '@/lib/api-auth';
import { fetchImmichAsset } from '@/lib/immich/client';
import { photoDb } from '@/lib/photo-firebase-admin';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const immich = await getUserImmichSettings(session.uid);
  if (!immich) {
    return NextResponse.json({ error: 'Immich not configured' }, { status: 400 });
  }

  const type =
    request.nextUrl.searchParams.get('type') === 'original' ? 'original' : 'thumbnail';

  try {
    // 📡 2. ลอจิกใหม่: วิ่งไปสอยลิงก์มุดท่อ Immich ตัวล่าสุดจาก Firestore โปรเจกต์ Photo
    const configDoc = await photoDb.collection('system').doc('tunnel_config').get();
    
    if (configDoc.exists) {
      const currentImmichUrl = configDoc.data()?.immich_url;

      // 🎯 3. ถ้าบนคลาวด์มียังมีลิงก์อัปเดตอยู่ ให้เอาลิงก์ไดนามิกนี้ไปสวมแทนที่ตัวเก่าในคอนฟิกทันที
      if (currentImmichUrl) {
        // แอบสลับช่องสัญญานไปใช้ลิงก์มุดท่อตัวใหม่ล่าสุดจากคอมบ้าน
        immich.baseUrl = currentImmichUrl; 
        
        // หมายเหตุ: โครงสร้างภายในวัตถุ immich ของคุณน่าจะมีหน้าตาประมาณ { baseUrl, apiKey }
        // การระบุบรรทัดนี้จะช่วยให้ฟังก์ชันข้างล่างดึงภาพผ่านท่อที่ถูกต้องได้ทันทีครับ
      }
    }

    // 📸 4. ยิงไปขอไฟล์ภาพจากเครื่องบ้านผ่านมาทางท่ออัปเดตตัวล่าสุด
    const res = await fetchImmichAsset(immich, id, type);
    if (!res.ok) {
      return NextResponse.json({ error: 'Asset not found' }, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch asset';
    console.error('[Immich] GET asset proxy failed:', {
      assetId: id,
      type,
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}