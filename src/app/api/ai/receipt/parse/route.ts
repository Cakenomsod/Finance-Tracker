import { NextRequest, NextResponse } from 'next/server';
import { verifySession, assertTripMember, getUserAiSettings, resolveLocalAiBaseUrl, resolveRequestedAiProvider } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
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
    const tripId = formData.get('tripId') as string | null;
    const extraInstructions = ((formData.get('extraInstructions') as string) || '').trim();
    const providerRaw = formData.get('provider') as string | null;

    if (!image || !(image instanceof Blob)) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }
    if (!tripId) {
      return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
    }

    const isMember = await assertTripMember(tripId, session.uid);
    if (!isMember) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (image.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image too large (max 8MB)' }, { status: 400 });
    }

    const mimeType = image.type || 'image/jpeg';
    if (!ALLOWED_TYPES.includes(mimeType)) {
      return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 });
    }

    const { provider: savedProvider } = await getUserAiSettings(session.uid);
    const provider: AiTextProvider = resolveRequestedAiProvider(providerRaw, savedProvider);

    const localAiBaseUrl = provider === 'local' ? await resolveLocalAiBaseUrl() : undefined;

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

    const tripDoc = await adminDb().collection('trips').doc(tripId).get();
    const trip = tripDoc.data();

    const draft = await parseReceiptImageWithProvider(
      buffer,
      mimeType,
      {
        provider,
        localAiConfig:
          provider === 'local' && localAiBaseUrl ? { baseUrl: localAiBaseUrl } : undefined,
      },
      {
        tripName: trip?.name,
        currency: trip?.tripCurrency,
        countryCode: trip?.countryCode,
        extraInstructions: extraInstructions || undefined,
      }
    );

    return NextResponse.json({ draft, provider });
  } catch (error) {
    console.error('[API] POST /api/ai/receipt/parse failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const message = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
