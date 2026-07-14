/** Client-side resize/compress so Immich uploads finish faster over tunnels. */

const MAX_EDGE = 2048
const JPEG_QUALITY = 0.82
const SKIP_IF_SMALLER_THAN = 400 * 1024 // keep tiny files as-is

function loadImageBitmap(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file)
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('ไม่สามารถบีบอัดรูปได้'))
      },
      type,
      quality
    )
  })
}

/**
 * Downscale + JPEG-compress large photos before upload.
 * Returns the original File when compression is unnecessary or unsupported.
 */
export async function compressImageForUpload(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }
  if (file.size <= SKIP_IF_SMALLER_THAN) {
    return file
  }
  if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
    return file
  }

  try {
    const bitmap = await loadImageBitmap(file)
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1
    const targetW = Math.max(1, Math.round(width * scale))
    const targetH = Math.max(1, Math.round(height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return file
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)
    bitmap.close()

    const outType =
      file.type === 'image/png' && hasTransparencyHint(file) ? 'image/png' : 'image/jpeg'
    const blob =
      outType === 'image/jpeg'
        ? await canvasToBlob(canvas, outType, JPEG_QUALITY)
        : await canvasToBlob(canvas, outType, 1)

    if (blob.size >= file.size * 0.95) {
      return file
    }

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    const ext = outType === 'image/png' ? 'png' : 'jpg'
    return new File([blob], `${baseName}.${ext}`, {
      type: outType,
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

function hasTransparencyHint(file: File): boolean {
  // Prefer retaining PNG for screenshots/UI captures; otherwise JPEG is fine.
  const name = file.name.toLowerCase()
  return name.endsWith('.png')
}
