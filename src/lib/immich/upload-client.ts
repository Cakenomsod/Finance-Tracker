import { uploadAttachmentToStorage } from '@/lib/attachments/storage'
import { pickClient } from '@/lib/i18n'

/** New photos always go to Firebase Storage; Immich only serves legacy attachments. */
export async function uploadAttachmentImage(
  file: File,
  options?: { tripId?: string | null; compress?: boolean }
): Promise<{ assetId: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error(
      pickClient({ th: 'กรุณาเลือกไฟล์รูปภาพ', en: 'Please choose an image file', zh: '请选择图片文件' })
    )
  }
  return uploadAttachmentToStorage(file, options)
}
