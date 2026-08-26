import { NextRequest, NextResponse } from 'next/server';
import { assertTripMember, getUserAiSettings, resolveLocalAiBaseUrl, resolveRequestedAiProvider, verifySession } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { parseExpenseTextWithProvider } from '@/lib/ai';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import { AiTextProvider } from '@/lib/firestore-types';
import { loadUserContactsForAi, mergeTripMembersIntoContacts } from '@/lib/ai/load-user-contacts';
import type { ExpenseTextAiContext } from '@/lib/ai/receipt-schema';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { text, tripId, provider: requestedProvider } = body;

    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const { provider: savedProvider } = await getUserAiSettings(session.uid);
    const provider: AiTextProvider = resolveRequestedAiProvider(requestedProvider, savedProvider);

    if (provider === 'gemma' && !getGoogleAiApiKey()) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY ยังไม่ได้ตั้งค่าในเซิร์ฟเวอร์' },
        { status: 503 }
      );
    }

    let sharedLocalAiUrl = '';
    if (provider === 'local') {
      sharedLocalAiUrl = (await resolveLocalAiBaseUrl()) || '';
      if (!sharedLocalAiUrl) {
        return NextResponse.json(
          { error: 'คอมบ้านเชื่อมต่อท่อสำเร็จ แต่ยังไม่ได้เปิดใช้งานโหมด Local AI บนเครื่องบ้าน' },
          { status: 400 }
        );
      }
    }

    let context: ExpenseTextAiContext | undefined;
    let contacts = await loadUserContactsForAi(session.uid);

    const userDoc = await adminDb().collection('users').doc(session.uid).get();
    const userCurrency =
      typeof userDoc.data()?.currency === 'string' ? userDoc.data()!.currency : 'THB';

    if (tripId) {
      if (typeof tripId !== 'string') {
        return NextResponse.json({ error: 'Invalid tripId' }, { status: 400 });
      }
      const isMember = await assertTripMember(tripId, session.uid);
      if (!isMember) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      const tripDoc = await adminDb().collection('trips').doc(tripId).get();
      const trip = tripDoc.data();
      context = {
        tripName: trip?.name,
        currency: trip?.tripCurrency || userCurrency,
        countryCode: trip?.countryCode,
      };
      contacts = await mergeTripMembersIntoContacts(contacts, tripId);
    } else {
      context = { currency: userCurrency };
    }

    const drafts = await parseExpenseTextWithProvider(
      text.trim(),
      {
        provider,
        localAiConfig: provider === 'local' && sharedLocalAiUrl ? { baseUrl: sharedLocalAiUrl } : undefined,
      },
      context,
      contacts
    );

    // drafts[0] kept as `draft` for backward compatibility with older clients
    return NextResponse.json({ drafts, draft: drafts[0], provider });
  } catch (error) {
    console.error('[API] POST /api/ai/expense/parse failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const errMessage = error instanceof Error ? error.message : 'Parse failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
