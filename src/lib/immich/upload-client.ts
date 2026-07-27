import { readApiJson } from '@/lib/api-json'
import { compressImageForUpload } from '@/lib/immich/compress-image'

/** Uploads to Immich; optional tripId is for membership auth only (album = user's displayName). */
export async function uploadImmichImage(
  file: File,
  options?: { tripId?: string | null; compress?: boolean }
): Promise<{ assetId: string }> {
  if (!file.type.startsWith('image/')) {
    throw new Error('กรุณาเลือกไฟล์รูปภาพ')
  }

  const prepared =
    options?.compress === false ? file : await compressImageForUpload(file)

  const form = new FormData()
  form.append('file', prepared)
  form.append('filename', prepared.name)
  const tripId = options?.tripId
  if (tripId && tripId !== 'none') {
    form.append('tripId', tripId)
  }

  const res = await fetch('/api/immich/upload', {
    method: 'POST',
    body: form,
    credentials: 'same-origin',
  })
  const data = await readApiJson<{ error?: string; assetId?: string }>(res)
  if (!res.ok) throw new Error(data.error || 'Upload failed')
  if (!data.assetId) throw new Error('Upload succeeded but no asset ID returned')
  return { assetId: data.assetId }
}
