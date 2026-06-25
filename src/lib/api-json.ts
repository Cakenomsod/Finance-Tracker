/**
 * Safely parse a fetch Response body as JSON.
 * Avoids surfacing raw "Unexpected token" SyntaxErrors when the server returns HTML or plain text.
 */
export async function readApiJson<T extends Record<string, unknown> = Record<string, unknown>>(
  res: Response
): Promise<T> {
  const text = await res.text();

  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(`คำขอล้มเหลว (HTTP ${res.status})`);
    }
    throw new Error('เซิร์ฟเวอร์ส่งคำตอบว่างเปล่า');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      throw new Error(
        res.status >= 500
          ? 'เซิร์ฟเวอร์ขัดข้องชั่วคราว — ลองอัปโหลดใหม่อีกครั้ง'
          : `ได้รับหน้า HTML แทน JSON (HTTP ${res.status}) — ลองรีเฟรชหรือล็อกอินใหม่`
      );
    }

    if (trimmed.startsWith('data:')) {
      throw new Error(
        'Local AI ส่งสตรีมกลับมาแทน JSON — ตรวจสอบว่าเปิด stream: false หรือลองใช้ Gemini'
      );
    }

    const preview = text.slice(0, 100).replace(/\s+/g, ' ').trim();
    throw new Error(
      res.ok
        ? 'ไม่สามารถอ่านผลลัพธ์จากเซิร์ฟเวอร์ได้'
        : `คำขอล้มเหลว (HTTP ${res.status})${preview ? `: ${preview}` : ''}`
    );
  }
}
