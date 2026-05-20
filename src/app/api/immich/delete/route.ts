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
    // 📡 2. ลอจิกใหม่: วิ่งไปสอยลิงก์มุดท่อ Immich ตัวล่าสุดจาก Firestore โปรเจกต์ Photo
    const configDoc = await photoDb.collection('system').doc('tunnel_config').get();
    
    if (configDoc.exists) {
      const currentImmichUrl = configDoc.data()?.immich_url;

      // 🎯 3. ถ้าบนคลาวด์มียังมีลิงก์อัปเดตอยู่ ให้เอาลิงก์ไดนามิกนี้ไปสวมแทนที่ตัวเก่าในคอนฟิกทันที
      if (currentImmichUrl) {
        immich.baseUrl = currentImmichUrl; // สลับช่องสัญญาณให้วิ่งไปหาท่อปัจจุบันของคอมบ้าน
      }
    }

    // 🗑️ 4. สั่งลบรูปภาพในเครื่องคอมที่บ้าน ผ่านท่อตัวล่าสุดอย่างแม่นยำ
    await deleteImmichAssets(immich, ids as string[]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[Immich] POST /api/immich/delete failed:', error);
    const message = error instanceof Error ? error.message : 'Delete failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}