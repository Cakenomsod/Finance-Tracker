import { SUPPORTED_CURRENCIES, isAppCurrency, type AppCurrency } from '@/lib/currency';

export type { AppCurrency } from '@/lib/currency';

export const LOCALE_STORAGE_KEY = 'finance-tracker-locale';

export const SUPPORTED_LOCALES = ['en', 'th', 'zh'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

/** Re-export for profile settings and other consumers. */
export const CURRENCIES = SUPPORTED_CURRENCIES;

const COUNTRY_LOCALE: Record<string, AppLocale> = {
  TH: 'th',
  US: 'en',
  GB: 'en',
  AU: 'en',
  CA: 'en',
  NZ: 'en',
  IE: 'en',
  SG: 'en',
  PH: 'en',
  IN: 'en',
  CN: 'zh',
  TW: 'zh',
  HK: 'zh',
};

const COUNTRY_CURRENCY: Record<string, AppCurrency> = {
  TH: 'THB',
  US: 'USD',
  JP: 'JPY',
  GB: 'GBP',
  AU: 'AUD',
  CA: 'CAD',
  NZ: 'NZD',
  SG: 'SGD',
  HK: 'HKD',
  CN: 'CNY',
  TW: 'TWD',
  CH: 'CHF',
  DK: 'DKK',
  NO: 'NOK',
  SE: 'SEK',
  IN: 'INR',
  KR: 'KRW',
  AE: 'AED',
  SA: 'SAR',
  QA: 'QAR',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  FI: 'EUR',
};

const EU_COUNTRIES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
]);

export function countryToLocale(countryCode: string | null | undefined): AppLocale {
  if (!countryCode) return 'en';
  const code = countryCode.toUpperCase();
  return COUNTRY_LOCALE[code] ?? 'en';
}

export function countryToCurrency(countryCode: string | null | undefined): AppCurrency {
  if (!countryCode) return 'THB';
  const code = countryCode.toUpperCase();
  const mapped = COUNTRY_CURRENCY[code];
  if (mapped && isAppCurrency(mapped)) return mapped;
  if (EU_COUNTRIES.has(code)) return 'EUR';
  return 'THB';
}

export function parseAcceptLanguage(header: string | null): AppLocale | null {
  if (!header) return null;
  const parts = header.split(',').map((p) => p.trim().split(';')[0].toLowerCase());
  for (const part of parts) {
    if (part.startsWith('th')) return 'th';
    if (part.startsWith('zh')) return 'zh';
    if (part.startsWith('en')) return 'en';
  }
  return null;
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'th' || value === 'zh';
}
