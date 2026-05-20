import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings, assertTripMember } from '@/lib/api-auth';
import {
  uploadToImmich,
  createImmichAlbum,
  addAssetsToImmichAlbum,
} from '@/lib/immich/client';
import { adminDb } from '@/lib/firebase-admin';
import { photoDb } from '@/lib/photo-firebase-admin';


const MAX_SIZE = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const immich = await getUserImmichSettings(session.uid);
  if (!immich) {
    return NextResponse.json(
      { error: 'Immich not configured. Add your tunnel URL and API key in Settings.' },
      { status: 400 }
    );
  }

  try {
    // 📡 2. ลอจิกใหม่: วิ่งไปสอยลิงก์มุดท่อ Immich ตัวล่าสุดจาก Firestore โปรเจกต์ Photo
    const configDoc = await photoDb().collection('system').doc('tunnel_config').get();
    
    if (configDoc.exists) {
      const currentImmichUrl = configDoc.data()?.immich_url;

      // 🎯 3. สวมรอยแทนที่ลิงก์เก่าทันที เพื่อให้ท่ออัปโหลดไหลลื่นไปยังคอมบ้านในปัจจุบัน
      if (currentImmichUrl) {
        immich.baseUrl = currentImmichUrl;
      }
    }

    const formData = await request.formData();
    const file = formData.get('file');
    const tripIdRaw = formData.get('tripId');
    const tripId = typeof tripIdRaw === 'string' && tripIdRaw.trim() ? tripIdRaw.trim() : null;

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (tripId) {
      const allowed = await assertTripMember(tripId, session.uid);
      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const mimeType = file.type || 'image/jpeg';
    const filename =
      (formData.get('filename') as string) ||
      `receipt-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // 📤 4. ยิงไฟล์ภาพขึ้นไปเซฟที่คอมบ้านผ่านท่อเวอร์ชันอัปเดตล่าสุด
    const result = await uploadToImmich(immich, buffer, filename, mimeType);

    // 📁 5. ส่งค่าคอนฟิกตัวที่สวมลิงก์อัปเดตแล้วเข้าไปจัดแจงอัลบั้มต่อ
    await assignToFinanceAlbum(session.uid, immich, tripId, result.id).catch((e) => {
      console.error('[Immich] album assignment failed (non-fatal):', e);
    });

    return NextResponse.json({
      assetId: result.id,
      status: 'success',
      thumbnailUrl: `/api/immich/asset/${result.id}?type=thumbnail`,
    });
  } catch (error) {
    console.error('[Immich] upload route error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// 🛠️ ฟังก์ชันจัดระเบียบอัลบั้ม (คงลอจิกเดิมของคุณไว้ทั้งหมด แต่ใช้งานผ่านท่อ baseUrl ใหม่ไร้สะดุด)
async function assignToFinanceAlbum(
  uid: string,
  immich: { baseUrl: string; apiKey: string },
  tripId: string | null,
  assetId: string
): Promise<void> {
  if (!adminDb()) return;

  if (tripId) {
    const tripRef = adminDb().collection('trips').doc(tripId);
    const snap = await tripRef.get();
    const name = (snap.data()?.name as string)?.trim() || 'Trip';
    let albumId = snap.data()?.immichAlbumId as string | undefined;

    if (albumId) {
      await addAssetsToImmichAlbum(immich, albumId, [assetId]);
    } else {
      const created = await createImmichAlbum(immich, `Finance · ${name}`, [assetId]);
      await tripRef.update({ immichAlbumId: created.id });
    }
    return;
  }

  const userRef = adminDb().collection('users').doc(uid);
  const usnap = await userRef.get();
  let albumId = usnap.data()?.immichGeneralAlbumId as string | undefined;

  if (albumId) {
    await addAssetsToImmichAlbum(immich, albumId, [assetId]);
  } else {
    const created = await createImmichAlbum(immich, 'Finance · ธุรกรรมทั่วไป', [assetId]);
    await userRef.update({ immichGeneralAlbumId: created.id });
  }
}