import { NextRequest, NextResponse } from 'next/server';
import { getUserAiSettings, verifySession } from '@/lib/api-auth';
import { sendChatWithProvider } from '@/lib/ai';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import { AiTextProvider } from '@/lib/firestore-types';
import { photoDb } from '@/lib/photo-firebase-admin'; // 👈 1. อิมพอร์ตตัวต่อสายข้ามค่ายเข้ามาเพิ่ม

const MAX_HISTORY = 20;

type ChatHistoryItem = { role: 'user' | 'assistant'; content: string };

function parseHistory(raw: unknown): ChatHistoryItem[] | undefined {
  if (!Array.isArray(raw)) return undefined;

  const items = raw
    .filter(
      (h): h is ChatHistoryItem =>
        !!h &&
        typeof h === 'object' &&
        (h.role === 'user' || h.role === 'assistant') &&
        typeof h.content === 'string' &&
        h.content.trim().length > 0
    )
    .map((h) => ({ role: h.role, content: h.content.trim() }));

  return items.length > 0 ? items.slice(-MAX_HISTORY) : undefined;
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { message, history: rawHistory, provider: requestedProvider } = body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const { provider: savedProvider } = await getUserAiSettings(session.uid);

    const provider: AiTextProvider =
      requestedProvider === 'gemma' || requestedProvider === 'local'
        ? requestedProvider
        : savedProvider;

    if (provider === 'gemma' && !getGoogleAiApiKey()) {
      return NextResponse.json(
        { error: 'GOOGLE_AI_API_KEY ยังไม่ได้ตั้งค่าในเซิร์ฟเวอร์' },
        { status: 503 }
      );
    }

    // 📡 2. ประกาศตัวแปรรับค่าลิงก์แบบ Dynamic
    let dynamicLocalAiUrl = "";

    // 📡 3. ลอจิกใหม่: ถ้าเลือกใช้โหมด 'local' ให้วิ่งข้ามไปคว้าลิงก์ปัจจุบันใน Firestore ของโปรเจกต์ Photo ทันที
    if (provider === 'local') {
      const configDoc = await photoDb().collection('system').doc('tunnel_config').get();
      
      if (!configDoc.exists) {
        return NextResponse.json(
          { error: 'ไม่พบข้อมูลท่อเชื่อมต่อบนคลาวด์ยานแม่ (คอมบ้านอาจจะยังไม่ได้ส่งข้อมูล)' },
          { status: 503 }
        );
      }

      // ดึงค่า ai_url ล่าสุดที่คอมบ้านอัปเดตไว้
      dynamicLocalAiUrl = configDoc.data()?.ai_url || "";

      if (!dynamicLocalAiUrl) {
        return NextResponse.json(
          { error: 'คอมบ้านเชื่อมต่อท่อสำเร็จ แต่ยังไม่ได้เปิดใช้งานโหมด Local AI' },
          { status: 400 }
        );
      }
    }

    const history = parseHistory(rawHistory);

    // 🤖 4. สวมลิงก์ไดนามิกตัวใหม่เข้าไปในคอนฟิกของเซสชันแชท
    const response = await sendChatWithProvider(
      message.trim(),
      {
        provider,
        localAiConfig: provider === 'local' && dynamicLocalAiUrl ? { baseUrl: dynamicLocalAiUrl } : undefined,
      },
      history
    );

    return NextResponse.json({ response, provider });
  } catch (error) {
    console.error('[API] POST /api/ai/chat/message failed:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    const errMessage = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}