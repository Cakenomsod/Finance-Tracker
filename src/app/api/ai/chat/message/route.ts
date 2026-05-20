import { NextRequest, NextResponse } from 'next/server';
import { getUserAiSettings, verifySession } from '@/lib/api-auth';
import { sendChatWithProvider } from '@/lib/ai';
import { getGoogleAiApiKey } from '@/lib/ai/env';
import { AiTextProvider } from '@/lib/firestore-types';

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

    const { provider: savedProvider, localAiBaseUrl } = await getUserAiSettings(session.uid);

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

    if (provider === 'local' && !localAiBaseUrl) {
      return NextResponse.json(
        { error: 'กรุณาตั้งค่า Local AI Base URL ในหน้า Settings ก่อนใช้งานแชท' },
        { status: 400 }
      );
    }

    const history = parseHistory(rawHistory);

    const response = await sendChatWithProvider(
      message.trim(),
      {
        provider,
        localAiConfig: provider === 'local' && localAiBaseUrl ? { baseUrl: localAiBaseUrl } : undefined,
      },
      history
    );

    return NextResponse.json({ response, provider });
  } catch (error) {
    console.error('Chat error:', error);
    const errMessage = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
