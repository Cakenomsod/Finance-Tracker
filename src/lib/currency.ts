export const SUPPORTED_CURRENCIES = [
  { code: 'THB', label: 'Thai Baht', symbol: '฿' },
  { code: 'USD', label: 'US Dollar', symbol: '$' },
  { code: 'EUR', label: 'Euro', symbol: '€' },
  { code: 'JPY', label: 'Japanese Yen', symbol: '¥' },
  { code: 'GBP', label: 'British Pound', symbol: '£' },
  { code: 'CNY', label: 'Chinese Yuan', symbol: '¥' },
  { code: 'AED', label: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AUD', label: 'Australian Dollar', symbol: 'A$' },
  { code: 'CAD', label: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', label: 'Swiss Franc', symbol: 'Fr' },
  { code: 'DKK', label: 'Danish Krone', symbol: 'kr' },
  { code: 'HKD', label: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'INR', label: 'Indian Rupee', symbol: '₹' },
  { code: 'KRW', label: 'South Korean Won', symbol: '₩' },
  { code: 'NOK', label: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NZD', label: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'QAR', label: 'Qatari Riyal', symbol: '﷼' },
  { code: 'SAR', label: 'Saudi Riyal', symbol: '﷼' },
  { code: 'SEK', label: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', label: 'Singapore Dollar', symbol: 'S$' },
  { code: 'TWD', label: 'Taiwan Dollar', symbol: 'NT$' },
] as const;

export type AppCurrency = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function isAppCurrency(value: unknown): value is AppCurrency {
  return SUPPORTED_CURRENCIES.some((c) => c.code === value);
}

export function currencySymbol(code: AppCurrency): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? code;
}

/** Currencies that display with 0 decimal places. */
const ZERO_DECIMAL_CURRENCIES = new Set<AppCurrency>(['JPY', 'KRW']);

export function formatMoneyAmount(
  amount: number,
  currency: AppCurrency,
  opts?: {
    showSign?: boolean;
    locale?: string;
    maximumFractionDigits?: number;
  }
): string {
  const fractionDigits =
    opts?.maximumFractionDigits ?? (ZERO_DECIMAL_CURRENCIES.has(currency) ? 0 : 2);
  const locale = opts?.locale ?? 'en-US';

  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Math.abs(amount));

  if (opts?.showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `−${formatted}`;
  }
  return formatted;
}

/**
 * Convert amount using a "units of currency per 1 USD" rate map (USD = 1).
 * Formula: amount / rates[from] * rates[to]
 */
export function convertCurrency(
  amount: number,
  from: AppCurrency,
  to: AppCurrency,
  rates: Record<string, number>
): number {
  if (from === to) return amount;
  const fromRate = rates[from] ?? STATIC_FALLBACK_RATES[from] ?? 1;
  const toRate = rates[to] ?? STATIC_FALLBACK_RATES[to] ?? 1;
  return (amount / fromRate) * toRate;
}

/** Approximate static fallback rates (USD = 1 base). */
export const STATIC_FALLBACK_RATES: Record<AppCurrency, number> = {
  USD: 1,
  EUR: 0.92,
  JPY: 149,
  GBP: 0.79,
  CNY: 7.25,
  AED: 3.67,
  AUD: 1.54,
  CAD: 1.37,
  CHF: 0.90,
  DKK: 6.88,
  HKD: 7.82,
  INR: 83.8,
  KRW: 1345,
  NOK: 10.6,
  NZD: 1.64,
  QAR: 3.64,
  SAR: 3.75,
  SEK: 10.4,
  SGD: 1.34,
  TWD: 32.3,
  THB: 35.5,
};
