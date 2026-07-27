import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings, assertTripMember } from '@/lib/api-auth';
import {
  uploadToImmich,
  createImmichAlbum,
  addAssetsToImmichAlbum,
  findImmichAlbumByName,
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
      {
        error: 'Immich server configuration is missing or incomplete. กรุณาตรวจสอบการตั้งค่าเซิร์ฟเวอร์หรือแจ้งผู้ดูแลระบบ',
      },
      { status: 503 }
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

    // 📁 5. Assign asset to the user's single Immich album (non-fatal)
    await assignToUserAlbum(session.uid, immich, result.id).catch((e) => {
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

function sanitizeAlbumName(raw: string): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100);
}

function resolveUserAlbumName(data: Record<string, unknown> | undefined, uid: string): string {
  const displayName = typeof data?.displayName === 'string' ? data.displayName.trim() : '';
  if (displayName) {
    const name = sanitizeAlbumName(displayName);
    if (name) return name;
  }

  const email = typeof data?.email === 'string' ? data.email.trim() : '';
  const localPart = email.includes('@') ? email.split('@')[0]! : email;
  if (localPart) {
    const name = sanitizeAlbumName(localPart);
    if (name) return name;
  }

  return sanitizeAlbumName(`User ${uid.slice(0, 6)}`) || `User ${uid.slice(0, 6)}`;
}

/** Assign asset to the uploader's single Immich album (displayName). Trip albums are not used. */
async function assignToUserAlbum(
  uid: string,
  immich: { baseUrl: string; apiKey: string },
  assetId: string
): Promise<void> {
  if (!adminDb()) return;

  const userRef = adminDb().collection('users').doc(uid);
  const usnap = await userRef.get();
  const data = usnap.data() as Record<string, unknown> | undefined;

  const existingId =
    (typeof data?.immichUserAlbumId === 'string' && data.immichUserAlbumId.trim()) ||
    (typeof data?.immichGeneralAlbumId === 'string' && data.immichGeneralAlbumId.trim()) ||
    '';

  if (existingId) {
    await addAssetsToImmichAlbum(immich, existingId, [assetId]);
    // Backfill immichUserAlbumId when only the legacy field was present
    if (data?.immichUserAlbumId !== existingId || data?.immichGeneralAlbumId !== existingId) {
      await userRef.update({
        immichUserAlbumId: existingId,
        immichGeneralAlbumId: existingId,
      });
    }
    return;
  }

  const albumName = resolveUserAlbumName(data, uid);

  // Reuse an Immich album already named for this user (avoids duplicate albums)
  const matched = await findImmichAlbumByName(immich, albumName).catch((e) => {
    console.error('[Immich] find album by name failed (will create):', e);
    return null;
  });

  if (matched) {
    await addAssetsToImmichAlbum(immich, matched.id, [assetId]);
    await userRef.update({
      immichUserAlbumId: matched.id,
      immichGeneralAlbumId: matched.id,
    });
    return;
  }

  const created = await createImmichAlbum(immich, albumName, [assetId]);
  await userRef.update({
    immichUserAlbumId: created.id,
    immichGeneralAlbumId: created.id,
  });
}