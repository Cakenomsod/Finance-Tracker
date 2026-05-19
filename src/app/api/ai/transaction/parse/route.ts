import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { parseReceiptImage } from '@/lib/ai/gemma';

const MAX_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const image = formData.get('image');

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }

    if (image.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 });
    }

    const mimeType = image.type || 'image/jpeg';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    const parsed = await parseReceiptImage(buffer, mimeType);

    return NextResponse.json({ draft: parsed });
  } catch (error) {
    console.error('Transaction receipt parse error:', error);
    const message = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
