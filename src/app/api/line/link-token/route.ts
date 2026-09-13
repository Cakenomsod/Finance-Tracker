import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { getLineConfig } from '@/lib/line/config';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const config = getLineConfig();
    const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    
    // Expires in 10 minutes
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await adminDb().collection('line_linking_tokens').add({
      userId: session.uid,
      token,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    });

    const textMessage = `/link ${token}`;
    const redirectUrl = `https://line.me/R/oaMessage/${config.botId}/?${encodeURIComponent(textMessage)}`;

    return NextResponse.json({ redirectUrl, token }); // Also send token explicitly!
  } catch (error) {
    console.error('Error generating link token:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await adminDb().collection('users').doc(session.uid).update({
      lineUserId: null,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
