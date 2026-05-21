import { cookies, headers } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { AiTextProvider } from '@/lib/firestore-types';
import { photoDb } from '@/lib/photo-firebase-admin';
import { getImmichApiKey } from '@/lib/ai/env';

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
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (error) {
    console.error("Auth Verification Error in back-end:", error);
    return null;
  }
}

export async function assertTripMember(tripId: string, uid: string): Promise<boolean> {
  const tripDoc = await adminDb().collection('trips').doc(tripId).get();
  if (!tripDoc.exists) return false;
  const trip = tripDoc.data();
  if (!trip) return false;
  const members = (trip.members as string[]) || [];
  return trip.createdBy === uid || members.includes(uid);
}

export async function getUserImmichSettings(uid: string) {
  try {
    const tunnelDoc = await photoDb().collection('system').doc('tunnel_config').get();
    const tunnel = tunnelDoc.exists ? (tunnelDoc.data() ?? {}) : {};

    const rawUrl = tunnel.immich_url as string | undefined;
    const baseUrl = rawUrl ? String(rawUrl).replace(/\/$/, '') : undefined;
    const apiKey = getImmichApiKey();

    if (!baseUrl || !apiKey) {
      return null;
    }

    return { baseUrl, apiKey };
  } catch (error) {
    console.error('getUserImmichSettings error:', error);
    return null;
  }
}

export async function getUserAiSettings(uid: string) {
  try {
    const userDoc = await adminDb().collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : undefined;

    const provider = (userData?.aiTextProvider as AiTextProvider) || 'gemma';
    let localAiBaseUrl: string | undefined;

    // If the provider is 'local', use the shared tunnel config from the Photo project
    if (provider === 'local') {
      try {
        const tunnelDoc = await photoDb().collection('system').doc('tunnel_config').get();
        const tunnel = tunnelDoc.exists ? (tunnelDoc.data() ?? {}) : {};
        const rawAi = (tunnel.ai_url || tunnel.aiUrl || tunnel.localAiBaseUrl) as string | undefined;
        if (rawAi) localAiBaseUrl = String(rawAi).replace(/\/$/, '');
      } catch (err) {
        console.error('Error reading tunnel_config for AI from photoDb:', err);
      }
    }

    return { provider, localAiBaseUrl };
  } catch (error) {
    console.error('getUserAiSettings error:', error);
    return { provider: 'gemma' as AiTextProvider, localAiBaseUrl: undefined };
  }
}
