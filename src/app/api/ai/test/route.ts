import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/api-auth';
import { testLocalAiConnection } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { baseUrl } = body;

    if (!baseUrl || typeof baseUrl !== 'string') {
      return NextResponse.json({ error: 'baseUrl is required' }, { status: 400 });
    }

    const connected = await testLocalAiConnection({ baseUrl });

    if (connected) {
      return NextResponse.json({ success: true, message: 'Local AI is connected' });
    }

    return NextResponse.json(
      { success: false, message: 'Cannot connect to Local AI' },
      { status: 500 }
    );
  } catch (error) {
    console.error('Local AI test error:', error);
    const errMessage = error instanceof Error ? error.message : 'Test failed';
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
