'use client'

import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { FirebaseError } from 'firebase/app'
import { auth, storage } from '@/lib/firebase'
import { compressImageForUpload } from '@/lib/immich/compress-image'
import { STORAGE_ATTACHMENT_PREFIX, storagePathOf } from '@/lib/attachments/ids'

/** Must match the size limit in storage.rules. */
const MAX_BYTES = 5 * 1024 * 1024

const EXT_BY_TYPE: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'image/gif': 'gif',
}

function newFileId(type: string) {
  const ext = EXT_BY_TYPE[type] ?? 'jpg'
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
}

function friendlyStorageError(error: unknown): string {
  const code = error instanceof FirebaseError ? error.code : ''
  if (code === 'storage/unauthenticated') return 'กรุณาเข้าสู่ระบบก่อนแนบรูป'
  if (code === 'storage/unauthorized') return 'ไม่มีสิทธิ์เก็บรูปนี้'
  if (code === 'storage/quota-exceeded') return 'พื้นที่เก็บรูปเต็ม — บันทึกรายการไปก่อนได้'
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/canceled') {
    return 'อัปโหลดรูปไม่สำเร็จ ลองใหม่อีกครั้ง'
  }
  return 'ระบบเก็บรูปยังไม่พร้อม — บันทึกรายการไปก่อนได้'
}

async function putImage(path: string, file: File, uid: string) {
  await uploadBytes(ref(storage, path), file, {
    contentType: file.type || 'image/jpeg',
    customMetadata: { uploadedBy: uid },
  })
}

/**
 * Upload a slip/receipt photo to Firebase Storage.
 * Trip uploads live under the trip so every member can view them; legacy name-based trips
 * fail the membership rule, so those fall back to the uploader's private folder.
 */
export async function uploadAttachmentToStorage(
  file: File,
  options?: { tripId?: string | null; compress?: boolean }
): Promise<{ assetId: string }> {
  const user = auth.currentUser
  if (!user) throw new Error('กรุณาเข้าสู่ระบบก่อนแนบรูป')

  const prepared = options?.compress === false ? file : await compressImageForUpload(file)
  if (prepared.size > MAX_BYTES) throw new Error('รูปใหญ่เกินไป (สูงสุด 5MB)')

  const fileId = newFileId(prepared.type)
  const userPath = `users/${user.uid}/attachments/${fileId}`
  const tripId = options?.tripId && options.tripId !== 'none' ? options.tripId : null

  try {
    if (tripId) {
      const tripPath = `trips/${tripId}/attachments/${fileId}`
      try {
        await putImage(tripPath, prepared, user.uid)
        return { assetId: `${STORAGE_ATTACHMENT_PREFIX}${tripPath}` }
      } catch (error) {
        if (!(error instanceof FirebaseError) || error.code !== 'storage/unauthorized') throw error
      }
    }
    await putImage(userPath, prepared, user.uid)
    return { assetId: `${STORAGE_ATTACHMENT_PREFIX}${userPath}` }
  } catch (error) {
    console.error('[Storage] attachment upload failed:', error)
    throw new Error(friendlyStorageError(error))
  }
}

const urlCache = new Map<string, Promise<string>>()

export function getAttachmentUrl(assetId: string): Promise<string> {
  const cached = urlCache.get(assetId)
  if (cached) return cached
  const pending = getDownloadURL(ref(storage, storagePathOf(assetId))).catch((error) => {
    urlCache.delete(assetId)
    throw error
  })
  urlCache.set(assetId, pending)
  return pending
}

export async function deleteStorageAttachments(assetIds: string[]): Promise<void> {
  const results = await Promise.allSettled(
    assetIds.map((id) => deleteObject(ref(storage, storagePathOf(id))))
  )
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      urlCache.delete(assetIds[i]!)
      return
    }
    const code = result.reason instanceof FirebaseError ? result.reason.code : ''
    if (code !== 'storage/object-not-found') {
      console.error('[Storage] attachment delete failed:', assetIds[i], result.reason)
    }
  })
}
