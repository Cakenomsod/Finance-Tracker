import { adminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { SUPPORTED_CURRENCIES, STATIC_FALLBACK_RATES, type AppCurrency } from '@/lib/currency';

const FX_RATES_URL = 'https://open.er-api.com/v6/latest/USD';
const SUPPORTED_CODES = new Set(SUPPORTED_CURRENCIES.map((c) => c.code));

export interface StoredFxRates {
  base: 'USD';
  rates: Record<string, number>;
  fetchedAt: Timestamp;
  source: string;
}

export async function getStoredFxRates(): Promise<StoredFxRates | null> {
  try {
    const doc = await adminDb().collection('system').doc('fx_rates').get();
    if (!doc.exists) return null;
    return doc.data() as StoredFxRates;
  } catch (err) {
    console.error('[FX] getStoredFxRates error:', err);
    return null;
  }
}

export async function saveFxRates(
  rates: Record<string, number>,
  source: string
): Promise<void> {
  await adminDb().collection('system').doc('fx_rates').set({
    base: 'USD',
    rates,
    fetchedAt: Timestamp.now(),
    source,
  });
}

export async function fetchLiveFxRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(FX_RATES_URL, { cache: 'no-store' });
    if (!res.ok) {
      console.error('[FX] fetchLiveFxRates HTTP error:', res.status);
      return null;
    }
    const json = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
    };
    if (json.result !== 'success' || !json.rates) {
      console.error('[FX] fetchLiveFxRates unexpected response:', json.result);
      return null;
    }

    const filtered: Record<string, number> = { USD: 1 };
    for (const [code, rate] of Object.entries(json.rates)) {
      if (SUPPORTED_CODES.has(code as AppCurrency)) {
        filtered[code] = rate;
      }
    }
    // Ensure THB is always present
    if (!filtered['THB'] && json.rates['THB']) {
      filtered['THB'] = json.rates['THB'];
    }

    return filtered;
  } catch (err) {
    console.error('[FX] fetchLiveFxRates error:', err);
    return null;
  }
}

const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export async function getFxRates(opts?: {
  forceRefresh?: boolean;
  maxAgeMs?: number;
}): Promise<{
  base: 'USD';
  rates: Record<string, number>;
  fetchedAt: Date;
  source: string;
}> {
  const maxAgeMs = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS;

  if (!opts?.forceRefresh) {
    const stored = await getStoredFxRates();
    if (stored) {
      const fetchedAt = stored.fetchedAt.toDate();
      const age = Date.now() - fetchedAt.getTime();
      if (age < maxAgeMs) {
        return { base: 'USD', rates: stored.rates, fetchedAt, source: stored.source };
      }
    }
  }

  const liveRates = await fetchLiveFxRates();
  if (liveRates) {
    await saveFxRates(liveRates, 'open.er-api.com');
    return {
      base: 'USD',
      rates: liveRates,
      fetchedAt: new Date(),
      source: 'open.er-api.com',
    };
  }

  // Fallback: stale stored rates, then static
  const stored = await getStoredFxRates();
  if (stored) {
    return {
      base: 'USD',
      rates: stored.rates,
      fetchedAt: stored.fetchedAt.toDate(),
      source: `${stored.source} (stale)`,
    };
  }

  return {
    base: 'USD',
    rates: STATIC_FALLBACK_RATES as Record<string, number>,
    fetchedAt: new Date(0),
    source: 'static-fallback',
  };
}
