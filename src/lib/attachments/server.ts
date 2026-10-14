import { adminStorageBucket } from '@/lib/firebase-admin';
import { STORAGE_ATTACHMENT_PREFIX, isStorageAttachment, storagePathOf } from '@/lib/attachments/ids';

/** Save a slip received outside the browser (e.g. LINE) into the user's private folder. */
export async function saveSlipForUser(
  uid: string,
  buffer: Buffer,
  options: { source: string; contentType?: string }
): Promise<string> {
  const contentType = options.contentType || 'image/jpeg';
  const ext = contentType === 'image/png' ? 'png' : 'jpg';
  const fileId = `${options.source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const path = `users/${uid}/attachments/${fileId}`;
  await adminStorageBucket().file(path).save(buffer, {
    contentType,
    resumable: false,
    metadata: { metadata: { uploadedBy: uid, source: options.source } },
  });
  return `${STORAGE_ATTACHMENT_PREFIX}${path}`;
}

export async function deleteSlips(assetIds: string[] | undefined): Promise<void> {
  const ids = (assetIds ?? []).filter(isStorageAttachment);
  await Promise.all(
    ids.map((id) =>
      adminStorageBucket()
        .file(storagePathOf(id))
        .delete({ ignoreNotFound: true })
        .catch((error) => console.error('[Storage] slip delete failed:', id, error))
    )
  );
}
