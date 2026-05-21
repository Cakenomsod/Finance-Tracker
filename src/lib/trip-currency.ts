import type { Trip } from '@/lib/firestore-types';
import type { TripCountryCode, TripCurrencyCode } from '@/lib/tax/countries';
import { suggestExchangeRate } from '@/lib/tax/countries';

export const LEGACY_JPY_TO_THB = 0.22;

/** Trip doc or minimal fields used for currency conversion */
export type TripCurrencySource =
  | Pick<Trip, 'tripCurrency' | 'homeCurrency' | 'exchangeRate' | 'countryCode'>
  | null
  | undefined;

const COUNTRY_TIME_ZONES: Record<string, string> = {
  TH: 'Asia/Bangkok',
  JP: 'Asia/Tokyo',
};

const CURRENCY_TIME_ZONES: Record<TripCurrencyCode, string> = {
  THB: 'Asia/Bangkok',
  JPY: 'Asia/Tokyo',
};

function getFixedTimeZoneOffsetMinutes(timeZone: string): number {
  switch (timeZone) {
    case 'Asia/Tokyo':
      return 9 * 60;
    case 'Asia/Bangkok':
      return 7 * 60;
    default:
      return new Date().getTimezoneOffset();
  }
}

export function getTripTimeZone(
  countryCode?: string | null,
  currency?: TripCurrencyCode
): string | null {
  if (countryCode && COUNTRY_TIME_ZONES[countryCode]) {
    return COUNTRY_TIME_ZONES[countryCode]
  }
  if (currency && CURRENCY_TIME_ZONES[currency]) {
    return CURRENCY_TIME_ZONES[currency]
  }
  return null
}

export function formatTripDate(date: Date, timeZone?: string | null): string {
  if (!timeZone) return date.toISOString().split('T')[0]
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export function formatTripTime(date: Date, timeZone?: string | null): string {
  if (!timeZone) return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export function parseTripLocalDateTime(
  date: string,
  time: string,
  timeZone?: string | null
): Date {
  if (!timeZone) {
    return new Date(`${date}T${time}`)
  }
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const offsetMinutes = getFixedTimeZoneOffsetMinutes(timeZone)
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offsetMinutes * 60000)
}
export function getTripCurrencySettings(trip?: TripCurrencySource) {
  const tripCurrency = (trip?.tripCurrency as TripCurrencyCode) || 'THB';
  const homeCurrency = (trip?.homeCurrency as TripCurrencyCode) || 'THB';
  const exchangeRate =
    trip?.exchangeRate ??
    suggestExchangeRate(tripCurrency, homeCurrency);

  return {
    countryCode: trip?.countryCode ?? null,
    tripCurrency,
    homeCurrency,
    exchangeRate,
  };
}

/** Convert an expense amount to home currency for display/settlement summaries */
export function convertToHomeCurrency(
  amount: number,
  expenseCurrency: TripCurrencyCode | undefined,
  trip?: TripCurrencySource
): number {
  const { tripCurrency, homeCurrency, exchangeRate } = getTripCurrencySettings(trip);
  const from = expenseCurrency ?? tripCurrency;

  if (from === homeCurrency) return amount;

  if (from === 'JPY' && homeCurrency === 'THB') {
    return amount * exchangeRate;
  }

  if (from === 'THB' && homeCurrency === 'JPY') {
    return exchangeRate > 0 ? amount / exchangeRate : amount;
  }

  return amount;
}

export function formatCurrencySymbol(currency: TripCurrencyCode): string {
  return currency === 'JPY' ? '¥' : '฿';
}

export function formatHomeConversion(
  amount: number,
  expenseCurrency: TripCurrencyCode | undefined,
  trip?: TripCurrencySource
): string | null {
  const { homeCurrency, tripCurrency } = getTripCurrencySettings(trip);
  const from = expenseCurrency ?? tripCurrency;
  if (from === homeCurrency) return null;
  const converted = convertToHomeCurrency(amount, expenseCurrency, trip);
  return `${formatCurrencySymbol(homeCurrency)}${converted.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}
