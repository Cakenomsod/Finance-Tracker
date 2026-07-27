/**
 * Ask the Next.js API to delete Immich assets (uses the logged-in user's Immich API key).
 * Fails silently in the UI except for console — callers should not block expense deletion.
 */
import { authFetch } from '@/lib/api-auth-client'
export async function requestDeleteImmichAssets(ids: string[]): Promise<void> {
  const clean = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
  if (clean.length === 0) return;

  try {
    const res = await authFetch('/api/immich/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: clean }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[Immich] delete API failed', { status: res.status, body: t.slice(0, 500) });
    }
  } catch (e) {
    console.error('[Immich] delete API network error', e);
  }
}
