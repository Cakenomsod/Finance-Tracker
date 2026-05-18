import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function verifySession(): Promise<{ uid: string } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get('__session')?.value;
  if (!token) return null;

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function assertTripMember(tripId: string, uid: string): Promise<boolean> {
  const tripDoc = await adminDb.collection('trips').doc(tripId).get();
  if (!tripDoc.exists) return false;
  const trip = tripDoc.data();
  if (!trip) return false;
  const members = (trip.members as string[]) || [];
  return trip.createdBy === uid || members.includes(uid);
}

export async function getUserImmichSettings(uid: string) {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) return null;
  const immich = userDoc.data()?.immich as { baseUrl?: string; apiKey?: string } | undefined;
  if (!immich?.baseUrl || !immich?.apiKey) return null;
  return {
    baseUrl: immich.baseUrl.replace(/\/$/, ''),
    apiKey: immich.apiKey,
  };
}
