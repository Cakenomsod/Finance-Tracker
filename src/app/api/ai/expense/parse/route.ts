import { NextRequest, NextResponse } from 'next/server';
import { assertTripMember, getUserAiSettings, resolveLocalAiBaseUrl, resolveRequestedAiProvider, verifySession } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { parseExpenseTextWithProvider } from '@/lib/ai';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import { AiTextProvider } from '@/lib/firestore-types';
import { loadUserContactsForAi, mergeTripMembersIntoContacts } from '@/lib/ai/load-user-contacts';
import { loadUserAccountsForAi } from '@/lib/ai/load-user-accounts';
import type { ExpenseTextAiContext } from '@/lib/ai/receipt-schema';
import { AI_UNAVAILABLE_MESSAGE, formatAiParseError, requestLocale } from '@/lib/ai/format-error';
import { pick } from '@/lib/i18n';

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
      console.error('[API] /api/ai/expense/parse: GOOGLE_AI_API_KEY is not set');
      return NextResponse.json(
        { error: pick(requestLocale(request), AI_UNAVAILABLE_MESSAGE) },
        { status: 503 }
      );
    }

    let sharedLocalAiUrl = '';
    if (provider === 'local') {
      sharedLocalAiUrl = (await resolveLocalAiBaseUrl()) || '';
      if (!sharedLocalAiUrl) {
        console.error('[API] /api/ai/expense/parse: local AI provider selected but no base URL configured');
        return NextResponse.json(
          { error: pick(requestLocale(request), AI_UNAVAILABLE_MESSAGE) },
          { status: 503 }
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

    // Trip expenses don't use personal accounts; skip the read there.
    const accounts = tripId
      ? undefined
      : await loadUserAccountsForAi(session.uid).catch(() => undefined);

    const drafts = await parseExpenseTextWithProvider(
      text.trim(),
      {
        provider,
        localAiConfig: provider === 'local' && sharedLocalAiUrl ? { baseUrl: sharedLocalAiUrl } : undefined,
      },
      context,
      contacts,
      accounts
    );

    // drafts[0] kept as `draft` for backward compatibility with older clients
    return NextResponse.json({ drafts, draft: drafts[0], provider });
  } catch (error) {
    console.error('[API] POST /api/ai/expense/parse failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json({ error: formatAiParseError(error, requestLocale(request)) }, { status: 500 });
  }
}
