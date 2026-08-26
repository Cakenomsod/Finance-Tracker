'use client';

import { useState, useEffect, useCallback } from 'react';
import { authFetch } from '@/lib/api-auth-client';
import { convertCurrency, STATIC_FALLBACK_RATES, type AppCurrency } from '@/lib/currency';

const CACHE_KEY = 'ft-fx-rates';
const CACHE_MAX_AGE_MS = 60 * 60 * 1000; // 1 hour client-side cache

interface CachedRates {
  rates: Record<string, number>;
  timestamp: number;
}

interface FxRatesState {
  rates: Record<string, number>;
  loading: boolean;
  error: string | null;
  source: string | null;
  fetchedAt: string | null;
}

function readSessionCache(): CachedRates | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (Date.now() - parsed.timestamp > CACHE_MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionCache(rates: Record<string, number>): void {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ rates, timestamp: Date.now() }));
  } catch {
    // sessionStorage unavailable (SSR / private mode)
  }
}

export function useExchangeRates() {
  const [state, setState] = useState<FxRatesState>({
    rates: STATIC_FALLBACK_RATES as Record<string, number>,
    loading: true,
    error: null,
    source: null,
    fetchedAt: null,
  });

  const fetchRates = useCallback(async (force = false) => {
    if (!force) {
      const cached = readSessionCache();
      if (cached) {
        setState((prev) => ({
          ...prev,
          rates: cached.rates,
          loading: false,
          source: 'session-cache',
        }));
        return;
      }
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const url = force ? '/api/fx/rates?refresh=1' : '/api/fx/rates';
      const res = await authFetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        rates: Record<string, number>;
        source: string;
        fetchedAt: string;
      };
      writeSessionCache(data.rates);
      setState({
        rates: data.rates,
        loading: false,
        error: null,
        source: data.source,
        fetchedAt: data.fetchedAt,
      });
    } catch (err) {
      console.error('[useExchangeRates] fetch error:', err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to fetch rates',
      }));
    }
  }, []);

  useEffect(() => {
    void fetchRates(false);
  }, [fetchRates]);

  const convert = useCallback(
    (amount: number, from: AppCurrency, to: AppCurrency) =>
      convertCurrency(amount, from, to, state.rates),
    [state.rates]
  );

  const refresh = useCallback(() => fetchRates(true), [fetchRates]);

  return {
    rates: state.rates,
    loading: state.loading,
    error: state.error,
    source: state.source,
    fetchedAt: state.fetchedAt,
    convert,
    refresh,
  };
}
