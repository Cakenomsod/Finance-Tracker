export interface ImmichConfig {
  baseUrl: string;
  apiKey: string;
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

// 1. แก้ไข Endpoint สำหรับการ Ping เช็กสถานะเซิร์ฟเวอร์ (ใช้ /api/server/ping)
export async function testImmichConnection(config: ImmichConfig): Promise<boolean> {
  const base = normalizeBaseUrl(config.baseUrl);
  try {
    const res = await fetch(`${base}/api/server/ping`, {
      method: 'GET',
      headers: { 'x-api-key': config.apiKey },
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch (error) {
    console.error('Immich connection test failed:', error);
    return false;
  }
}

// 2. แก้ไข Endpoint เป็น /api/assets และเพิ่มฟิลด์บังคับ (isFavorite, duration)
export async function uploadToImmich(
  config: ImmichConfig,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<{ id: string }> {
  const base = normalizeBaseUrl(config.baseUrl);
  const now = new Date().toISOString();
  // Immich แนะนำให้โครงสร้างไอดีไม่ยาวเกินไปและไม่สับสน
  const deviceAssetId = `finance-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const form = new FormData();
  
  // แนบไฟล์แบบ Binary ข้อมูลภาพ
  form.append(
    'assetData',
    new Blob([new Uint8Array(file)], { type: mimeType }),
    filename
  );
  
  // ฟิลด์บังคับ (Required fields) ตาม Immich API Spec ตระกูล /api/assets
  form.append('deviceAssetId', deviceAssetId);
  form.append('deviceId', 'finance-tracker-web');
  form.append('fileCreatedAt', now);
  form.append('fileModifiedAt', now);
  form.append('isFavorite', 'false'); // ⚠️ บังคับส่งเป็น String 'true' หรือ 'false'
  form.append('duration', '00:00:00.000000'); // ⚠️ บังคับส่งสำหรับระบุความยาววิดีโอ (ถ้ารูปภาพใส่ 0 ทิ้งไว้)

  // เปลี่ยนจาก /api/assets/upload เป็น /api/assets
  const res = await fetch(`${base}/api/assets`, {
    method: 'POST',
    headers: { 'x-api-key': config.apiKey },
    body: form,
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Immich upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  // Immich จะส่ง object ของ asset ที่สร้างเสร็จแล้วกลับมา ซึ่งมีฟิลด์ id แน่นอน
  return { id: data.id };
}

// 3. ปรับปรุงตัวดึงรูปภาพย่อให้ระบุ Size ตามข้อกำหนด (thumbnail หรือ preview)
export async function fetchImmichAsset(
  config: ImmichConfig,
  assetId: string,
  type: 'thumbnail' | 'original' = 'thumbnail'
): Promise<Response> {
  const base = normalizeBaseUrl(config.baseUrl);
  
  // ใน Immich Parameter size จะรับค่าเป็น 'thumbnail' หรือ 'preview' เท่านั้น
  const path =
    type === 'thumbnail'
      ? `/api/assets/${assetId}/thumbnail?size=thumbnail`
      : `/api/assets/${assetId}/original`;

  return fetch(`${base}${path}`, {
    headers: { 'x-api-key': config.apiKey },
    signal: AbortSignal.timeout(30000),
  });
}