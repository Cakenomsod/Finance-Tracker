import { uploadAttachmentToStorage } from '@/lib/attachments/storage'

/** New photos always go to Firebase Storage; Immich only serves legacy attachments. */
export async function uploadAttachmentImage(
  file: File,
  options?: { tripId?: string | null; compress?: boolean }
): Promise<{ assetId: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ')
  }
  return uploadAttachmentToStorage(file, options)
}
