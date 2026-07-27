const MAX_ALBUM_NAME_LENGTH = 100;

/** Trim, collapse whitespace, strip control chars; max 100 chars; fallback `'User'`. */
export function sanitizeImmichAlbumName(name: string): string {
  const cleaned = name
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_ALBUM_NAME_LENGTH)
    .trim();

  return cleaned || 'User';
}
