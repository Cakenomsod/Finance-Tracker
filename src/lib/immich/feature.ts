import { pickClient, type LocalizedText } from '@/lib/i18n'

/**
 * Immich photo storage is paused by default. Existing asset ids stay on records untouched
 * so photos reappear once this is turned back on with NEXT_PUBLIC_IMMICH_ENABLED=1.
 */
export const IMMICH_ENABLED = process.env.NEXT_PUBLIC_IMMICH_ENABLED === '1'

export const IMMICH_MAINTENANCE_MESSAGE = 'ระบบรูปแนบอยู่ระหว่างปรับปรุง'

export const IMMICH_MAINTENANCE_TEXT: LocalizedText = {
  th: IMMICH_MAINTENANCE_MESSAGE,
  en: 'Photo attachments are under maintenance',
  zh: '图片附件功能维护中',
}

/** Maintenance notice in the current UI language (client-side). */
export function immichMaintenanceMessage(): string {
  return pickClient(IMMICH_MAINTENANCE_TEXT)
}
