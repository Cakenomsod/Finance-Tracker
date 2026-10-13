import { randomInt } from 'crypto';
import { NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { verifySession } from '@/lib/api-auth';
import { adminDb } from '@/lib/firebase-admin';
import { getLineConfig } from '@/lib/line/config';

const TOKEN_TTL_MS = 15 * 60 * 1000;
/** No 0/O/1/I/L so the code survives being read aloud or retyped on a phone. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newLinkCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

function lineUrls(botId: string, code?: string) {
  const id = encodeURIComponent(botId);
  return {
    addFriendUrl: `https://line.me/R/ti/p/${id}`,
    ...(code
      ? { redirectUrl: `https://line.me/R/oaMessage/${id}/?${encodeURIComponent(`/link ${code}`)}` }
      : {}),
  };
}

/** Link status — lets the page restore a pending code after refresh. */
export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { botId } = getLineConfig();
    const db = adminDb();
    const [userSnap, tokenSnap] = await Promise.all([
      db.collection('users').doc(session.uid).get(),
      db.collection('line_linking_tokens').where('userId', '==', session.uid).get(),
    ]);
    const user = userSnap.data() ?? {};
    const now = Date.now();
    const pendingDoc = tokenSnap.docs
      .map((d) => d.data())
      .filter((d) => d.expiresAt?.toMillis?.() > now)
      .sort((a, b) => b.expiresAt.toMillis() - a.expiresAt.toMillis())[0];

    return NextResponse.json({
      linked: typeof user.lineUserId === 'string' && user.lineUserId.length > 0,
      displayName: user.lineDisplayName ?? null,
      pictureUrl: user.linePictureUrl ?? null,
      linkedAt: user.lineLinkedAt?.toMillis?.() ?? null,
      botId,
      ...lineUrls(botId),
      pending: pendingDoc
        ? {
            code: pendingDoc.token as string,
            expiresAt: pendingDoc.expiresAt.toMillis() as number,
            ...lineUrls(botId, pendingDoc.token),
          }
        : null,
    });
  } catch (error) {
    console.error('[LINE] link status failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { botId } = getLineConfig();
    const db = adminDb();

    // One live code per user: older codes would otherwise stay valid in parallel.
    const old = await db.collection('line_linking_tokens').where('userId', '==', session.uid).get();
    const batch = db.batch();
    old.docs.forEach((d) => batch.delete(d.ref));

    const code = newLinkCode();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    batch.set(db.collection('line_linking_tokens').doc(), {
      userId: session.uid,
      token: code,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(expiresAt),
    });
    await batch.commit();

    return NextResponse.json({ token: code, expiresAt, botId, ...lineUrls(botId, code) });
  } catch (error) {
    console.error('[LINE] generate link token failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await adminDb().collection('users').doc(session.uid).update({
      lineUserId: FieldValue.delete(),
      lineDisplayName: FieldValue.delete(),
      linePictureUrl: FieldValue.delete(),
      lineLinkedAt: FieldValue.delete(),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[LINE] unlink failed:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}