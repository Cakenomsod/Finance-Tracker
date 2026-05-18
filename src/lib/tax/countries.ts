export type TripCountryCode = 'TH' | 'JP';
export type TripCurrencyCode = 'THB' | 'JPY';
export type TaxCategoryId = 'food' | 'goods' | 'standard' | 'exempt';
export type TaxMode = 'exclusive' | 'inclusive';

export interface TaxRule {
  id: TaxCategoryId;
  label: string;
  labelTh: string;
  rate: number;
}

export interface CountryTaxConfig {
  countryCode: TripCountryCode;
  name: string;
  nameTh: string;
  defaultCurrency: TripCurrencyCode;
  defaultTaxMode: TaxMode;
  taxRules: TaxRule[];
}

export const COUNTRY_TAX_CONFIGS: Record<TripCountryCode, CountryTaxConfig> = {
  TH: {
    countryCode: 'TH',
    name: 'Thailand',
    nameTh: 'ไทย',
    defaultCurrency: 'THB',
    defaultTaxMode: 'exclusive',
    taxRules: [
      { id: 'standard', label: 'Standard (VAT)', labelTh: 'มาตรฐาน (VAT 7%)', rate: 0.07 },
      { id: 'exempt', label: 'Exempt', labelTh: 'ยกเว้นภาษี', rate: 0 },
    ],
  },
  JP: {
    countryCode: 'JP',
    name: 'Japan',
    nameTh: 'ญี่ปุ่น',
    defaultCurrency: 'JPY',
    defaultTaxMode: 'inclusive',
    taxRules: [
      { id: 'food', label: 'Food & drink', labelTh: 'อาหาร/เครื่องดื่ม (8%)', rate: 0.08 },
      { id: 'goods', label: 'Goods & other', labelTh: 'สินค้าทั่วไป (10%)', rate: 0.1 },
      { id: 'exempt', label: 'Exempt', labelTh: 'ยกเว้นภาษี', rate: 0 },
    ],
  },
};

export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  'JPY_THB': 0.22,
  'THB_THB': 1,
  'THB_JPY': 1 / 0.22,
  'JPY_JPY': 1,
};

export function getCountryConfig(countryCode?: string | null): CountryTaxConfig | null {
  if (!countryCode || !(countryCode in COUNTRY_TAX_CONFIGS)) return null;
  return COUNTRY_TAX_CONFIGS[countryCode as TripCountryCode];
}

export function getTaxRule(countryCode: string, taxCategoryId: TaxCategoryId): TaxRule | null {
  const config = getCountryConfig(countryCode);
  if (!config) return null;
  return config.taxRules.find((r) => r.id === taxCategoryId) ?? config.taxRules[0] ?? null;
}

export function getDefaultTaxCategory(countryCode: string): TaxCategoryId {
  const config = getCountryConfig(countryCode);
  if (!config) return 'standard';
  return config.taxRules[0]?.id ?? 'standard';
}

export function suggestExchangeRate(
  tripCurrency: TripCurrencyCode,
  homeCurrency: TripCurrencyCode
): number {
  const key = `${tripCurrency}_${homeCurrency}`;
  return DEFAULT_EXCHANGE_RATES[key] ?? 1;
}
