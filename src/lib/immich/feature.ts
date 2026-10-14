/**
 * Immich photo storage is paused by default. Existing asset ids stay on records untouched
 * so photos reappear once this is turned back on with NEXT_PUBLIC_IMMICH_ENABLED=1.
 */
export const IMMICH_ENABLED = process.env.NEXT_PUBLIC_IMMICH_ENABLED === '1'

export const IMMICH_MAINTENANCE_MESSAGE = 'ระบบรูปแนบอยู่ระหว่างปรับปรุง'
