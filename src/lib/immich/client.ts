export interface ImmichConfig {
  baseUrl: string;
  apiKey: string;
}

export function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

/** For logs only — avoids leaking full URLs with tokens in query strings. */
export function redactImmichUrlForLog(fullUrl: string): string {
  try {
    const u = new URL(fullUrl);
    return `${u.pathname}${u.search ? '(?…)' : ''}`;
  } catch {
    return '(invalid-url)';
  }
}

function logImmichFailure(
  operation: string,
  fullUrl: string,
  status: number,
  statusText: string,
  bodyPreview: string
): void {
  console.error('[Immich]', operation, 'failed', {
    path: redactImmichUrlForLog(fullUrl),
    status,
    statusText,
    bodyPreview: bodyPreview.slice(0, 800),
  });
}

async function immichFetch(
  config: ImmichConfig,
  path: string,
  init: RequestInit & { timeoutMs?: number },
  operation: string
): Promise<Response> {
  const base = normalizeBaseUrl(config.baseUrl);
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const timeoutMs = init.timeoutMs ?? 60000;
  const { timeoutMs: _t, ...fetchInit } = init;
  const signal =
    fetchInit.signal ??
    AbortSignal.timeout(timeoutMs);

  try {
    const res = await fetch(url, { ...fetchInit, signal });
    if (!res.ok) {
      res
        .clone()
        .text()
        .then((errText) =>
          logImmichFailure(operation, url, res.status, res.statusText, errText)
        )
        .catch(() => logImmichFailure(operation, url, res.status, res.statusText, ''));
    }
    return res;
  } catch (error) {
    console.error('[Immich]', operation, 'network/abort', {
      path: redactImmichUrlForLog(url),
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
    });
    throw error;
  }
}

/** DELETE /api/assets — body { ids, force? } (Immich v2). */
export async function deleteImmichAssets(
  config: ImmichConfig,
  ids: string[],
  options?: { force?: boolean }
): Promise<void> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const res = await immichFetch(
    config,
    '/api/assets',
    {
      method: 'DELETE',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ids: unique,
        ...(options?.force ? { force: true } : {}),
      }),
      timeoutMs: 60000,
    },
    'deleteAssets'
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Immich delete failed (${res.status}): ${t || res.statusText}`);
  }
}

export interface ImmichAlbumSummary {
  id: string;
  albumName: string;
}

function mapImmichAlbumSummary(raw: unknown): ImmichAlbumSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const id = typeof obj.id === 'string' ? obj.id.trim() : '';
  const albumName =
    typeof obj.albumName === 'string'
      ? obj.albumName
      : typeof obj.album_name === 'string'
        ? obj.album_name
        : '';
  if (!id || !albumName) return null;
  return { id, albumName };
}

/** GET /api/albums — returns id + albumName for each album. */
export async function listImmichAlbums(
  config: ImmichConfig
): Promise<ImmichAlbumSummary[]> {
  const res = await immichFetch(
    config,
    '/api/albums',
    {
      method: 'GET',
      headers: { 'x-api-key': config.apiKey },
      timeoutMs: 30000,
    },
    'listAlbums'
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Immich list albums failed (${res.status}): ${t || res.statusText}`);
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    throw new Error('Immich list albums: expected an array response');
  }

  return data
    .map(mapImmichAlbumSummary)
    .filter((album): album is ImmichAlbumSummary => album !== null);
}

/** Case-insensitive trim match on albumName. */
export async function findImmichAlbumByName(
  config: ImmichConfig,
  name: string
): Promise<ImmichAlbumSummary | null> {
  const needle = name.trim().toLowerCase();
  if (!needle) return null;

  const albums = await listImmichAlbums(config);
  return (
    albums.find((album) => album.albumName.trim().toLowerCase() === needle) ?? null
  );
}

/**
 * PATCH /api/albums/:id with `{ albumName }`.
 * Throws clearly on failure so callers can catch and ignore.
 */
export async function updateImmichAlbumName(
  config: ImmichConfig,
  albumId: string,
  albumName: string
): Promise<void> {
  const id = albumId.trim();
  if (!id) throw new Error('Immich update album name: missing album id');

  const res = await immichFetch(
    config,
    `/api/albums/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ albumName }),
      timeoutMs: 30000,
    },
    'updateAlbumName'
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(
      `Immich update album name failed (${res.status}): ${t || res.statusText}`
    );
  }
}

/** POST /api/albums — returns album id. */
export async function createImmichAlbum(
  config: ImmichConfig,
  albumName: string,
  assetIds: string[]
): Promise<{ id: string }> {
  const res = await immichFetch(
    config,
    '/api/albums',
    {
      method: 'POST',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        albumName,
        ...(assetIds.length ? { assetIds } : {}),
      }),
      timeoutMs: 60000,
    },
    'createAlbum'
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Immich create album failed (${res.status}): ${t}`);
  }

  const data = (await res.json()) as { id: string };
  if (!data?.id) throw new Error('Immich create album: missing id in response');
  return { id: data.id };
}

/** PUT /api/albums/:id/assets — body { ids } */
export async function addAssetsToImmichAlbum(
  config: ImmichConfig,
  albumId: string,
  assetIds: string[]
): Promise<void> {
  const unique = [...new Set(assetIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;

  const res = await immichFetch(
    config,
    `/api/albums/${albumId}/assets`,
    {
      method: 'PUT',
      headers: {
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: unique }),
      timeoutMs: 60000,
    },
    'addAssetsToAlbum'
  );

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Immich add to album failed (${res.status}): ${t}`);
  }
}

// 1. Ping เช็กสถานะเซิร์ฟเวอร์ (ใช้ /api/server/ping)
export async function testImmichConnection(config: ImmichConfig): Promise<boolean> {
  try {
    const res = await immichFetch(
      config,
      '/api/server/ping',
      {
        method: 'GET',
        headers: { 'x-api-key': config.apiKey },
        timeoutMs: 10000,
      },
      'ping'
    );
    return res.ok;
  } catch (error) {
    console.error('[Immich] ping exception:', error);
    return false;
  }
}

/**
 * POST /api/assets (Immich v3 AssetMediaCreateDto).
 * - duration: number | null (milliseconds). Omit for images; never send legacy "HH:MM:SS" strings.
 * - deviceId / deviceAssetId: removed in Immich v3 — do not send.
 */
export async function uploadToImmich(
  config: ImmichConfig,
  file: Buffer,
  filename: string,
  mimeType: string,
  options?: { durationMs?: number }
): Promise<{ id: string }> {
  const now = new Date().toISOString();

  const form = new FormData();

  form.append(
    'assetData',
    new Blob([new Uint8Array(file)], { type: mimeType }),
    filename
  );

  form.append('fileCreatedAt', now);
  form.append('fileModifiedAt', now);
  form.append('isFavorite', 'false');

  // Immich v3: duration is ms (number). Legacy "00:00:00.000000" coerces to NaN → 400.
  const durationMs = options?.durationMs;
  if (typeof durationMs === 'number' && Number.isFinite(durationMs) && durationMs >= 0) {
    form.append('duration', String(Math.round(durationMs)));
  }

  const res = await immichFetch(
    config,
    '/api/assets',
    {
      method: 'POST',
      headers: { 'x-api-key': config.apiKey },
      body: form,
      timeoutMs: 60000,
    },
    'uploadAsset'
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Immich upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { id: data.id };
}

export type ImmichAssetType = 'thumbnail' | 'preview' | 'original';

/** GET Immich asset bytes: thumbnail / mid-size preview / original. */
export async function fetchImmichAsset(
  config: ImmichConfig,
  assetId: string,
  type: ImmichAssetType = 'thumbnail'
): Promise<Response> {
  const path =
    type === 'original'
      ? `/api/assets/${assetId}/original`
      : `/api/assets/${assetId}/thumbnail?size=${type === 'preview' ? 'preview' : 'thumbnail'}`;

  const operation =
    type === 'original'
      ? 'getOriginal'
      : type === 'preview'
        ? 'getPreview'
        : 'getThumbnail';

  return immichFetch(
    config,
    path,
    {
      method: 'GET',
      headers: { 'x-api-key': config.apiKey },
      timeoutMs: 30000,
    },
    operation
  );
}