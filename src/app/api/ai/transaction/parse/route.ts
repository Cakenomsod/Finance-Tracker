import { NextRequest, NextResponse } from 'next/server';
import { verifySession, getUserAiSettings } from '@/lib/api-auth';
import { parseReceiptImageWithProvider } from '@/lib/ai';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import { AiTextProvider } from '@/lib/firestore-types';

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
    const extraInstructions = ((formData.get('extraInstructions') as string) || '').trim();
    const providerRaw = formData.get('provider') as string | null;

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

    const { provider: savedProvider, localAiBaseUrl } = await getUserAiSettings(session.uid);
    const provider: AiTextProvider =
      providerRaw === 'local' || providerRaw === 'gemma' ? providerRaw : savedProvider;

    if (provider === 'local' && !localAiBaseUrl?.trim()) {
      return NextResponse.json(
        { error: 'กรุณาตั้งค่า Local AI Base URL ในหน้า Settings' },
        { status: 400 }
      );
    }
    if (provider === 'gemma' && !getGoogleAiApiKey()) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY / GEMINI_API_KEY ยังไม่ได้ตั้งในเซิร์ฟเวอร์ (Production)' },
        { status: 503 }
      );
    }

    const buffer = Buffer.from(await image.arrayBuffer());

    const draft = await parseReceiptImageWithProvider(
      buffer,
      mimeType,
      {
        provider,
        localAiConfig:
          provider === 'local' && localAiBaseUrl ? { baseUrl: localAiBaseUrl } : undefined,
      },
      {
        extraInstructions: extraInstructions || undefined,
      }
    );

    return NextResponse.json({ draft, provider });
  } catch (error) {
    console.error('[API] POST /api/ai/transaction/parse failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const message = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
