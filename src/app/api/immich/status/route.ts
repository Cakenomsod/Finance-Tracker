import { NextResponse } from 'next/server'
import { getUserImmichSettings, verifySession } from '@/lib/api-auth'
import { getImmichApiKey } from '@/lib/ai/env'
import { photoDb } from '@/lib/photo-firebase-admin'

/**
 * Immich is configured via Photo Firebase `system/tunnel_config.immich_url`
 * + server `IMMICH_API_KEY` — not via the Finance user profile document.
 */
export async function GET() {
  const session = await verifySession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const settings = await getUserImmichSettings(session.uid)
    if (settings) {
      let host: string | null = null
      try {
        host = new URL(settings.baseUrl).host
      } catch {
        host = settings.baseUrl
      }
      return NextResponse.json({
        configured: true,
        hasTunnelUrl: true,
        hasApiKey: true,
        host,
      })
    }

    let hasTunnelUrl = false
    try {
      const tunnelDoc = await photoDb().collection('system').doc('tunnel_config').get()
      const rawUrl = tunnelDoc.exists
        ? (tunnelDoc.data()?.immich_url as string | undefined)
        : undefined
      hasTunnelUrl = Boolean(rawUrl && String(rawUrl).trim())
    } catch {
      hasTunnelUrl = false
    }

    return NextResponse.json({
      configured: false,
      hasTunnelUrl,
      hasApiKey: Boolean(getImmichApiKey()),
      host: null,
    })
  } catch (error) {
    console.error('[Immich] status failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Status check failed' },
      { status: 500 }
    )
  }
}
