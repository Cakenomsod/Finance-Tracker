/**
 * Normalize legacy single-id and multi-id Immich fields on expenses/transactions.
 */
export function collectImmichAssetIds(fields: {
  immichAssetId?: string | null;
  immichAssetIds?: string[] | null;
}): string[] {
  const fromArray = fields.immichAssetIds?.filter((id): id is string => !!id && id.trim() !== '') ?? []
  if (fromArray.length > 0) return [...new Set(fromArray)]
  if (fields.immichAssetId?.trim()) return [fields.immichAssetId.trim()]
  return []
}
