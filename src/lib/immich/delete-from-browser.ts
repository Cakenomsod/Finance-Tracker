/**
 * Delete attachment photos: Firebase Storage objects directly, legacy Immich assets via the API.
 * Fails silently in the UI except for console — callers should not block expense deletion.
 */
import { authFetch } from '@/lib/api-auth-client'
import { isStorageAttachment } from '@/lib/attachments/ids'
import { deleteStorageAttachments } from '@/lib/attachments/storage'
import { IMMICH_ENABLED } from '@/lib/immich/feature'

export async function requestDeleteImmichAssets(ids: string[]): Promise<void> {
  const clean = [...new Set(ids.map((i) => i.trim()).filter(Boolean))];
  if (clean.length === 0) return;

  const storageIds = clean.filter(isStorageAttachment);
  const immichIds = clean.filter((id) => !isStorageAttachment(id));

  if (storageIds.length > 0) {
    await deleteStorageAttachments(storageIds);
  }
  if (immichIds.length === 0 || !IMMICH_ENABLED) return;

  try {
    const res = await authFetch('/api/immich/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: immichIds }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      console.error('[Immich] delete API failed', { status: res.status, body: t.slice(0, 500) });
    }
  } catch (e) {
    console.error('[Immich] delete API network error', e);
  }
}
