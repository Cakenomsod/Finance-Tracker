import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserImmichSettings } from '@/lib/api-auth';
import { uploadToImmich } from '@/lib/immich/client';

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
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large (max 15MB)' }, { status: 400 });
    }

    const mimeType = file.type || 'image/jpeg';
    const filename =
      (formData.get('filename') as string) ||
      `receipt-${Date.now()}.${mimeType.split('/')[1] || 'jpg'}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // 🚀 ยิงเข้าฟังก์ชันที่เราปรับปรุง spec เรียบร้อยแล้ว
    const result = await uploadToImmich(immich, buffer, filename, mimeType);

    return NextResponse.json({
      assetId: result.id,
      status: 'success', // 🛠️ ปรับเปลี่ยนจาก result.status เป็นข้อความตรงๆ เพราะยึดตาม spec ล่าสุด
      thumbnailUrl: `/api/immich/asset/${result.id}?type=thumbnail`,
    });
  } catch (error) {
    console.error('Immich upload error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
