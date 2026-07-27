/** Client-side resize/compress to WebP (JPEG/PNG fallbacks) so Immich uploads finish faster over tunnels. */

const MAX_EDGE = 1600
const WEBP_QUALITY = 0.8
const JPEG_QUALITY = 0.82
const SKIP_IF_SMALLER_THAN = 350 * 1024 // keep tiny files as-is (~300–400KB)
const SIZE_KEEP_RATIO = 0.95 // keep original unless output is meaningfully smaller

/** Cached once per page load via a tiny canvas probe. */
let webpSupported: boolean | null = null

function supportsWebP(): boolean {
  if (webpSupported !== null) return webpSupported
  if (typeof document === 'undefined') {
    webpSupported = false
    return false
  }
  try {
    const probe = document.createElement('canvas')
    probe.width = 1
    probe.height = 1
    webpSupported = probe.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpSupported = false
  }
  return webpSupported
}

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

type Encoded = { blob: Blob; type: string; ext: string }

/**
 * Encode with fallback chain. Transparent PNGs never fall through to JPEG.
 * WebP → JPEG → original (opaque) | WebP → PNG → original (alpha PNG).
 */
async function encodeWithFallbacks(
  canvas: HTMLCanvasElement,
  file: File,
  keepAlpha: boolean
): Promise<Encoded | null> {
  const attempts: Array<{ type: string; quality: number; ext: string }> = []

  if (supportsWebP()) {
    attempts.push({ type: 'image/webp', quality: WEBP_QUALITY, ext: 'webp' })
  }

  if (keepAlpha) {
    // WebP keeps alpha; otherwise stay on PNG. Never force JPEG on transparent PNGs.
    attempts.push({ type: 'image/png', quality: 1, ext: 'png' })
  } else {
    attempts.push({ type: 'image/jpeg', quality: JPEG_QUALITY, ext: 'jpg' })
  }

  for (const attempt of attempts) {
    try {
      const blob = await canvasToBlob(canvas, attempt.type, attempt.quality)
      // Some browsers claim support but emit a different type — skip those.
      if (blob.type && blob.type !== attempt.type) continue
      if (blob.size >= file.size * SIZE_KEEP_RATIO) continue
      return { blob, type: attempt.type, ext: attempt.ext }
    } catch {
      // try next format
    }
  }

  return null
}

/**
 * Downscale + WebP-compress large photos before upload (JPEG/PNG fallbacks).
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

    const keepAlpha = isLikelyTransparentPng(file)
    const encoded = await encodeWithFallbacks(canvas, file, keepAlpha)
    if (!encoded) return file

    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image'
    return new File([encoded.blob], `${baseName}.${encoded.ext}`, {
      type: encoded.type,
      lastModified: Date.now(),
    })
  } catch {
    return file
  }
}

function isLikelyTransparentPng(file: File): boolean {
  return file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')
}
