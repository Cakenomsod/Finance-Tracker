import type { Trip } from '@/lib/firestore-types';
import type { TripCurrencyCode } from '@/lib/tax/countries';
import { suggestExchangeRate } from '@/lib/tax/countries';

export const LEGACY_JPY_TO_THB = 0.22;

/** Trip doc or minimal fields used for currency conversion */
export type TripCurrencySource =
  | Pick<Trip, 'tripCurrency' | 'homeCurrency' | 'exchangeRate' | 'countryCode'>
  | null
  | undefined;

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
