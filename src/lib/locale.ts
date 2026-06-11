export const LOCALE_STORAGE_KEY = 'finance-tracker-locale';

export const SUPPORTED_LOCALES = ['en', 'th'] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const CURRENCIES = [
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
] as const;

export type AppCurrency = (typeof CURRENCIES)[number]['code'];

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
};

const COUNTRY_CURRENCY: Record<string, AppCurrency> = {
  TH: 'THB',
  US: 'USD',
  JP: 'JPY',
  GB: 'USD',
  AU: 'USD',
  CA: 'USD',
  NZ: 'USD',
  SG: 'USD',
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
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
  if (COUNTRY_CURRENCY[code]) {
    const c = COUNTRY_CURRENCY[code];
    if (c === 'THB' || c === 'USD' || c === 'EUR' || c === 'JPY') return c;
  }
  if (EU_COUNTRIES.has(code)) return 'EUR';
  return 'THB';
}

export function parseAcceptLanguage(header: string | null): AppLocale | null {
  if (!header) return null;
  const parts = header.split(',').map((p) => p.trim().split(';')[0].toLowerCase());
  for (const part of parts) {
    if (part.startsWith('th')) return 'th';
    if (part.startsWith('en')) return 'en';
  }
  return null;
}

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === 'en' || value === 'th';
}
