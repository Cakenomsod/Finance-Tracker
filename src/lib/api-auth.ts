import { cookies, headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { AiTextProvider } from '@/lib/firestore-types';

export async function verifySession(): Promise<{ uid: string } | null> {
  try {
    // 🔑 1. ช่องทางที่ 1: ลองเปิดเช็กใน Headers เผื่อหน้าบ้านยิงมาแบบ Bearer Token
    const authHeader = (await headers()).get('Authorization');
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    // 🔑 2. ช่องทางที่ 2: ถ้าใน Header ไม่มี ค่อยถอยกลับไปเปิดตู้คุกกี้ __session แบบเดิมของคุณ
    if (!token) {
      const cookieStore = await cookies();
      token = cookieStore.get('__session')?.value ?? null;
    }

    // ถ้าท้ายที่สุดแล้ว ค้นหาไม่เจอจากทั้งสองที่ ก็ส่งกลับ null (401)
    if (!token) return null;

    // ส่งรหัสไปให้ Firebase Admin ตรวจสอบความถูกต้อง
    const decoded = await adminAuth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (error) {
    console.error("Auth Verification Error in back-end:", error);
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

export async function getUserAiSettings(uid: string) {
  const userDoc = await adminDb.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return { provider: 'gemma' as AiTextProvider, localAiBaseUrl: undefined };
  }
  const userData = userDoc.data();
  return {
    provider: (userData?.aiTextProvider as AiTextProvider) || 'gemma',
    localAiBaseUrl: userData?.localAiBaseUrl as string | undefined,
  };
}
