import { NextRequest, NextResponse } from 'next/server';
import { verifySession, assertTripMember, getUserAiSettings } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { parseReceiptImageWithProvider } from '@/lib/ai';

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

    const buffer = Buffer.from(await image.arrayBuffer());

    const tripDoc = await adminDb.collection('trips').doc(tripId).get();
    const trip = tripDoc.data();

    // Get user's AI settings
    const aiSettings = await getUserAiSettings(session.uid);

    const parsed = await parseReceiptImageWithProvider(
      buffer,
      mimeType,
      {
        provider: aiSettings.provider,
        localAiConfig: aiSettings.provider === 'local' && aiSettings.localAiBaseUrl
          ? { baseUrl: aiSettings.localAiBaseUrl }
          : undefined,
      },
      {
        tripName: trip?.name,
        currency: trip?.tripCurrency,
        countryCode: trip?.countryCode,
      }
    );

    return NextResponse.json({ draft: parsed });
  } catch (error) {
    console.error('Receipt parse error:', error);
    const message = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
