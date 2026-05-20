/**
 * Normalize legacy single-id and multi-id Immich fields on expenses/transactions.
 */
export function collectImmichAssetIds(fields: {
  immichAssetId?: string | null;
  immichAssetIds?: string[] | null;
}): string[] {
  const fromArray = fields.immichAssetIds?.filter((id): id is string => !!id && id.trim() !== '') ?? []
  const single = fields.immichAssetId?.trim()
  const merged = [...fromArray, ...(single ? [single] : [])]
  return [...new Set(merged)]
}
