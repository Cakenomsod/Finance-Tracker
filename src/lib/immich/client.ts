export interface ImmichConfig {
  baseUrl: string;
  apiKey: string;
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

export async function testImmichConnection(config: ImmichConfig): Promise<boolean> {
  const base = normalizeBaseUrl(config.baseUrl);
  const res = await fetch(`${base}/api/server/ping`, {
    headers: { 'x-api-key': config.apiKey },
    signal: AbortSignal.timeout(10000),
  });
  return res.ok;
}

export async function uploadToImmich(
  config: ImmichConfig,
  file: Buffer,
  filename: string,
  mimeType: string
): Promise<{ id: string; status: string }> {
  const base = normalizeBaseUrl(config.baseUrl);
  const now = new Date().toISOString();
  const deviceAssetId = `finance-tracker-${Date.now()}-${filename}`;

  const form = new FormData();
  form.append(
    'assetData',
    new Blob([new Uint8Array(file)], { type: mimeType }),
    filename
  );
  form.append('deviceAssetId', deviceAssetId);
  form.append('deviceId', 'finance-tracker-web');
  form.append('fileCreatedAt', now);
  form.append('fileModifiedAt', now);
  form.append('isVisible', 'true');

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
  return { id: data.id, status: data.status };
}

export async function fetchImmichAsset(
  config: ImmichConfig,
  assetId: string,
  type: 'thumbnail' | 'original' = 'thumbnail'
): Promise<Response> {
  const base = normalizeBaseUrl(config.baseUrl);
  const path =
    type === 'thumbnail'
      ? `/api/assets/${assetId}/thumbnail`
      : `/api/assets/${assetId}/original`;

  return fetch(`${base}${path}`, {
    headers: { 'x-api-key': config.apiKey },
    signal: AbortSignal.timeout(30000),
  });
}
