import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings } from '@/lib/api-auth';
import { deleteImmichAssets } from '@/lib/immich/client';
import { photoDb } from '@/lib/photo-firebase-admin';

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
    // 📡 1. วิ่งไปสอยลิงก์มุดท่อ Immich ตัวล่าสุดจาก Firestore โปรเจกต์ Photo
    const configDoc = await photoDb().collection('system').doc('tunnel_config').get();
    
    if (configDoc.exists) {
      const currentImmichUrl = configDoc.data()?.immich_url;
      if (currentImmichUrl) {
        immich.baseUrl = currentImmichUrl; // สลับช่องสัญญาณให้ถูกท่อ
      }
    }

    // 🗑️ 2. สั่งลบรูปภาพ (ส่งอาร์เรย์ ids ตรงๆ เข้าไปตามที่ฟังก์ชันของ client ต้องการ)
    // หมายเหตุ: มั่นใจว่าด้านบนของไฟล์มีบรรทัด const ids = ... แกะเตรียมไว้แล้วนะคัรบ
    await deleteImmichAssets(immich, ids as string[]);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    // 💡 ตรงนี้แหละ! สั่งพ่น log ฝั่งเซิร์ฟเวอร์ดูให้ชัดๆ เลยว่า คอมบ้านตอบปฏิเสธอะไรกลับมา
    console.error('[API Immich Delete] จริงๆ แล้วพังเพราะอะไรกันแน่:', error);
    
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}