import { pickClient } from '@/lib/i18n';

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
      throw new Error(
        pickClient({
          th: `คำขอล้มเหลว (HTTP ${res.status})`,
          en: `Request failed (HTTP ${res.status})`,
          zh: `请求失败（HTTP ${res.status}）`,
        })
      );
    }
    throw new Error(
      pickClient({
        th: 'เซิร์ฟเวอร์ส่งคำตอบว่างเปล่า',
        en: 'The server returned an empty response',
        zh: '服务器返回了空响应',
      })
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const trimmed = text.trimStart();
    if (trimmed.startsWith('<')) {
      throw new Error(
        res.status >= 500
          ? pickClient({
              th: 'เซิร์ฟเวอร์ขัดข้องชั่วคราว — ลองอัปโหลดใหม่อีกครั้ง',
              en: 'The server is temporarily unavailable — please try again',
              zh: '服务器暂时故障 — 请重试',
            })
          : pickClient({
              th: `ได้รับหน้า HTML แทน JSON (HTTP ${res.status}) — ลองรีเฟรชหรือล็อกอินใหม่`,
              en: `Got an HTML page instead of JSON (HTTP ${res.status}) — try refreshing or signing in again`,
              zh: `收到 HTML 页面而不是 JSON（HTTP ${res.status}）— 请刷新或重新登录`,
            })
      );
    }

    if (trimmed.startsWith('data:')) {
      throw new Error(
        pickClient({
          th: 'Local AI ส่งสตรีมกลับมาแทน JSON — ตรวจสอบว่าเปิด stream: false หรือลองใช้ Gemini',
          en: 'Local AI returned a stream instead of JSON — check that stream: false is set, or try Gemini',
          zh: '本地 AI 返回了流式数据而不是 JSON — 请确认已设置 stream: false，或改用 Gemini',
        })
      );
    }

    const preview = text.slice(0, 100).replace(/\s+/g, ' ').trim();
    throw new Error(
      res.ok
        ? pickClient({
            th: 'ไม่สามารถอ่านผลลัพธ์จากเซิร์ฟเวอร์ได้',
            en: "Couldn't read the server response",
            zh: '无法读取服务器返回的结果',
          })
        : pickClient({
            th: `คำขอล้มเหลว (HTTP ${res.status})${preview ? `: ${preview}` : ''}`,
            en: `Request failed (HTTP ${res.status})${preview ? `: ${preview}` : ''}`,
            zh: `请求失败（HTTP ${res.status}）${preview ? `：${preview}` : ''}`,
          })
    );
  }
}
