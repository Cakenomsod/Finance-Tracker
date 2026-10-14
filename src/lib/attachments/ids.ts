/**
 * Attachment ids share the `immichAssetIds` fields on transactions/trip expenses.
 * Firebase Storage photos are stored as `fs:<object path>`; anything else is a legacy Immich asset id.
 */
export const STORAGE_ATTACHMENT_PREFIX = 'fs:'

export function isStorageAttachment(id: string): boolean {
  return id.startsWith(STORAGE_ATTACHMENT_PREFIX)
}

export function storagePathOf(id: string): string {
  return id.slice(STORAGE_ATTACHMENT_PREFIX.length)
}

/** Legacy `receiptUrl` only ever pointed at the Immich proxy. */
export function legacyReceiptUrl(primaryId: string | undefined | null): string | null {
  return primaryId && !isStorageAttachment(primaryId) ? `/api/immich/asset/${primaryId}` : null
}
